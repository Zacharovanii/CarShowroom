from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Brand(models.Model):
    """Марка автомобиля: BMW, Mercedes-Benz, Toyota..."""

    name = models.CharField('Название', max_length=50, unique=True)
    country = models.CharField('Страна', max_length=50, blank=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'марка'
        verbose_name_plural = 'марки'

    def __str__(self):
        return self.name


class Feature(models.Model):
    """Опция комплектации: панорамная крыша, адаптивный круиз и т.п."""

    name = models.CharField('Название', max_length=100, unique=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'опция'
        verbose_name_plural = 'опции'

    def __str__(self):
        return self.name


class UsedCar(models.Model):
    """Объявление о продаже автомобиля с пробегом."""

    # PROTECT: марку с объявлениями удалить нельзя, иначе пропадут и они
    brand = models.ForeignKey(
        Brand, on_delete=models.PROTECT, related_name='cars', verbose_name='Марка'
    )
    model = models.CharField('Модель', max_length=100)
    year = models.PositiveSmallIntegerField(
        'Год выпуска', validators=[MinValueValidator(1950), MaxValueValidator(2100)]
    )
    mileage_km = models.PositiveIntegerField('Пробег, км')
    # Деньги — Decimal, а не float: без ошибок округления
    price = models.DecimalField('Цена, ₽', max_digits=12, decimal_places=2)
    description = models.TextField('Описание', blank=True)
    features = models.ManyToManyField(
        Feature, blank=True, related_name='cars', verbose_name='Опции'
    )
    # Новое объявление с сайта скрыто, пока его не проверит менеджер в админке
    is_published = models.BooleanField('Опубликовано', default=False)
    created_at = models.DateTimeField('Добавлено', auto_now_add=True)

    class Meta:
        ordering = ['-created_at', '-id']  # id — при равном времени добавления
        verbose_name = 'автомобиль с пробегом'
        verbose_name_plural = 'автомобили с пробегом'

    def __str__(self):
        return f'{self.brand} {self.model}, {self.year}'
