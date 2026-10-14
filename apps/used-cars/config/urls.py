"""Корневые маршруты. Все адреса раздела начинаются с /used/ — так он
встраивается в основной сайт (в dev Vite проксирует /used сюда)."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

urlpatterns = [
    path('used/admin/', admin.site.urls),
    path('used/', include('used_cars.urls')),
    # Корень нужен, только когда сервер открыт напрямую (runserver, :8000);
    # через основной сайт / принадлежит SPA и сюда не доходит
    path('', RedirectView.as_view(pattern_name='home')),
]

# Раздача фото самим Django — только в режиме разработки (DEBUG)
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
