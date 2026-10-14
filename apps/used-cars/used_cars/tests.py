from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


class PagesTests(TestCase):
    # В фикстуре 12 машин, две (pk 8 и 12) ждут модерации
    fixtures = ['used_cars']

    def test_static_pages_open(self):
        for name in ('home', 'car_list', 'about'):
            self.assertEqual(self.client.get(reverse(name)).status_code, 200, name)

    def test_list_shows_only_published(self):
        cars = self.client.get(reverse('car_list')).context['cars']
        self.assertEqual(len(cars), 10)
        self.assertTrue(all(car.is_published for car in cars))

    def test_unpublished_detail_is_hidden_from_visitor(self):
        self.assertEqual(self.client.get(reverse('car_detail', args=[1])).status_code, 200)
        self.assertEqual(self.client.get(reverse('car_detail', args=[8])).status_code, 404)

    def test_staff_sees_unpublished_detail(self):
        staff = get_user_model().objects.create_user('manager', password='test-pass', is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get(reverse('car_detail', args=[8])).status_code, 200)


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
