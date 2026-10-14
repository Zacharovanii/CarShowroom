from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse


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
