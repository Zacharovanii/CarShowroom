import tempfile

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .models import UsedCar


class PagesTests(TestCase):
    # В фикстуре 24 машины, две (pk 8 и 12) ждут модерации
    fixtures = ['used_cars']

    def test_static_pages_open(self):
        for name in ('home', 'car_list', 'about'):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

    def test_list_shows_only_published(self):
        cars = self.client.get(reverse('car_list')).context['cars']
        self.assertEqual(len(cars), 22)
        self.assertTrue(all(car.is_published for car in cars))

    def test_search_and_brand_filter(self):
        def models(**params):
            return [car.model for car in self.client.get(reverse('car_list'), params).context['cars']]

        self.assertEqual(models(q='x5'), ['X5 xDrive30d'])
        self.assertEqual(  # поиск по марке
            models(q='toyota'), ['Land Cruiser 200 4.5d', 'RAV4 2.0 4WD', 'Camry 2.5 XSE']
        )
        # Фильтр по марке + сортировка по цене; Q5 (на модерации) не попадает
        self.assertEqual(models(brand=3, sort='cheap'), ['A6 2.0 TFSI quattro', 'A4 40 TFSI'])
        self.assertEqual(models(brand='abc', sort='bad'), models())  # мусор в адресе игнорируется

    def test_missing_photo_files_fall_back_to_placeholder(self):
        # Чистый клон: записи о фото есть, файлов в media/ нет
        with tempfile.TemporaryDirectory() as empty_media, self.settings(MEDIA_ROOT=empty_media):
            response = self.client.get(reverse('car_detail', args=[1]))
        self.assertEqual(response.context['car'].gallery, [])
        self.assertContains(response, 'car-placeholder.svg')

    def test_unpublished_detail_is_hidden_from_visitor(self):
        self.assertEqual(self.client.get(reverse('car_detail', args=[1])).status_code, 200)
        self.assertEqual(self.client.get(reverse('car_detail', args=[8])).status_code, 404)

    def test_staff_sees_unpublished_detail(self):
        staff = get_user_model().objects.create_user('manager', password='test-pass', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get(reverse('car_detail', args=[8])).status_code, 200)


class FormsTests(TestCase):
    fixtures = ['used_cars']

    car_data = {
        'brand': 1, 'model': '118i', 'year': 2016, 'mileage_km': 150000,
        'owners_count': 2, 'price': '1500000', 'features': [2, 4], 'description': '',
    }

    def test_add_saves_hidden_car_with_features(self):
        response = self.client.post(reverse('car_add'), self.car_data)
        self.assertRedirects(response, reverse('car_list'))
        car = UsedCar.objects.get(model='118i')
        self.assertFalse(car.is_published)
        self.assertEqual(car.features.count(), 2)

    def test_add_rejects_future_year(self):
        response = self.client.post(reverse('car_add'), {**self.car_data, 'year': 2100})
        self.assertEqual(response.status_code, 200)
        self.assertIn('year', response.context['form'].errors)

    def test_edit_requires_staff(self):
        response = self.client.get(reverse('car_edit', args=[1]))
        self.assertRedirects(response, f"{reverse('admin:login')}?next={reverse('car_edit', args=[1])}")

    def test_staff_edits_car(self):
        staff = get_user_model().objects.create_user('manager', password='test-pass', is_staff=True)
        self.client.force_login(staff)
        response = self.client.post(reverse('car_edit', args=[8]), {**self.car_data, 'is_published': 'on'})
        self.assertRedirects(response, reverse('car_detail', args=[8]))
        car = UsedCar.objects.get(pk=8)
        self.assertTrue(car.is_published)
        self.assertEqual(car.model, '118i')


class AdminTests(TestCase):
    fixtures = ['used_cars']

    def setUp(self):
        admin_user = get_user_model().objects.create_superuser('admin', 'admin@example.com', 'test-pass')
        self.client.force_login(admin_user)

    def test_changelists_open(self):
        # Каждая модель зарегистрирована, список с поиском и фильтрами открывается
        for name in ('brand', 'feature', 'usedcar'):
            url = reverse(f'admin:used_cars_{name}_changelist')
            self.assertEqual(self.client.get(url, {'q': 'a'}).status_code, 200, name)

    def test_publish_action(self):
        url = reverse('admin:used_cars_usedcar_changelist')
        self.client.post(url, {'action': 'publish', '_selected_action': [8, 12]})
        self.assertEqual(self.client.get(url, {'is_published__exact': '0'}).context['cl'].result_count, 0)
