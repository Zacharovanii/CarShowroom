from django.urls import path

from . import views

# Имена маршрутов — для {% url %} в шаблонах и redirect() во views
urlpatterns = [
    path('', views.home, name='home'),
    path('cars/', views.car_list, name='car_list'),
    path('cars/add/', views.car_add, name='car_add'),
    path('cars/<int:pk>/', views.car_detail, name='car_detail'),
    path('cars/<int:pk>/edit/', views.car_edit, name='car_edit'),
    path('about/', views.about, name='about'),
]
