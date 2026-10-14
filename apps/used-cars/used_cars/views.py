from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.db.models import Avg, Count, Min, Q
from django.shortcuts import get_object_or_404, redirect, render

from .forms import UsedCarEditForm, UsedCarForm
from .models import Brand, UsedCar


# Варианты сортировки списка: значение в URL → (подпись, поля order_by)
SORT_OPTIONS = {
    'new': ('Сначала новые объявления', ('-created_at', '-id')),
    'cheap': ('Сначала дешёвые', ('price',)),
    'expensive': ('Сначала дорогие', ('-price',)),
    'mileage': ('С меньшим пробегом', ('mileage_km',)),
    'year': ('Сначала новее по году', ('-year',)),
}


def published_cars():
    """Опубликованные объявления — всё, что видит посетитель сайта.

    select_related подтягивает марку тем же запросом: в карточке она нужна всегда.
    """
    return UsedCar.objects.filter(is_published=True).select_related('brand')


def brands_with_cars():
    """Марки, у которых есть опубликованные объявления, с их числом."""
    return (
        Brand.objects.annotate(published_count=Count('cars', filter=Q(cars__is_published=True)))
        .filter(published_count__gt=0)
    )


def home(request):
    cars = published_cars()
    context = {
        'latest_cars': cars[:3],
        'cars_count': cars.count(),
        'brands': brands_with_cars(),
        # Агрегаты считает БД: {'min_price': ..., 'avg_mileage': ...}
        **cars.aggregate(min_price=Min('price'), avg_mileage=Avg('mileage_km')),
    }
    return render(request, 'used_cars/home.html', context)


def car_list(request):
    # Фильтры живут в адресе (?q=...&brand=...&sort=...): ссылкой можно поделиться
    query = request.GET.get('q', '').strip()
    brand_id = request.GET.get('brand', '')
    sort = request.GET.get('sort', 'new')
    if sort not in SORT_OPTIONS:
        sort = 'new'

    cars = published_cars()
    if query:
        # Q объединяет условия через ИЛИ: слово ищется в модели, марке и описании
        cars = cars.filter(
            Q(model__icontains=query) | Q(brand__name__icontains=query) | Q(description__icontains=query)
        )
    if brand_id.isdigit():
        cars = cars.filter(brand_id=brand_id)
    cars = cars.order_by(*SORT_OPTIONS[sort][1])

    context = {
        'cars': cars,
        'query': query,
        'brand_id': brand_id,
        'sort': sort,
        'brands': brands_with_cars(),
        'sort_options': {key: label for key, (label, _) in SORT_OPTIONS.items()},
    }
    return render(request, 'used_cars/car_list.html', context)


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
