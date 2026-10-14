from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Avg, Min
from django.shortcuts import get_object_or_404, redirect, render

from .forms import UsedCarEditForm, UsedCarForm
from .models import Brand, UsedCar


def published_cars():
    """Опубликованные объявления — всё, что видит посетитель сайта.

    select_related подтягивает марку тем же запросом: в карточке она нужна всегда.
    """
    return UsedCar.objects.filter(is_published=True).select_related('brand')


def home(request):
    cars = published_cars()
    context = {
        'latest_cars': cars[:3],
        'cars_count': cars.count(),
        'brands_count': Brand.objects.filter(cars__is_published=True).distinct().count(),
        # Агрегаты считает БД: {'min_price': ..., 'avg_mileage': ...}
        **cars.aggregate(min_price=Min('price'), avg_mileage=Avg('mileage_km')),
    }
    return render(request, 'used_cars/home.html', context)


def car_list(request):
    cars = published_cars().order_by('-created_at', '-id')
    return render(request, 'used_cars/car_list.html', {'cars': cars})


def car_detail(request, pk):
    cars = UsedCar.objects.select_related('brand').prefetch_related('features')
    # Объявление на модерации видит только сотрудник, остальным — 404
    if not request.user.is_staff:
        cars = cars.filter(is_published=True)
    car = get_object_or_404(cars, pk=pk)
    return render(request, 'used_cars/car_detail.html', {'car': car})


def car_add(request):
    """Объявление от посетителя: сохраняется скрытым и ждёт модерации."""
    if request.method == 'POST':
        form = UsedCarForm(request.POST)
        if form.is_valid():
            car = form.save()  # save() у ModelForm сохраняет и опции (ManyToMany)
            messages.success(request, f'Объявление «{car}» отправлено. Оно появится на сайте после проверки менеджером.')
            return redirect('car_list')
    else:
        form = UsedCarForm()
    return render(request, 'used_cars/car_form.html', {'form': form, 'title': 'Предложить автомобиль'})


# Править объявления может только сотрудник; гостя отправит на вход в админку
@staff_member_required
def car_edit(request, pk):
    car = get_object_or_404(UsedCar, pk=pk)
    if request.method == 'POST':
        # instance — форма меняет существующую запись, а не создаёт новую
        form = UsedCarEditForm(request.POST, instance=car)
        if form.is_valid():
            form.save()
            messages.success(request, 'Изменения сохранены.')
            return redirect('car_detail', pk=car.pk)
    else:
        form = UsedCarEditForm(instance=car)
    return render(request, 'used_cars/car_form.html', {'form': form, 'title': f'Редактирование: {car}', 'car': car})


def about(request):
    return render(request, 'used_cars/about.html')
