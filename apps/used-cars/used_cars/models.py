from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.functional import cached_property


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
    # Добавлено второй миграцией: default заполняет уже существующие строки
    owners_count = models.PositiveSmallIntegerField(
        'Владельцев по ПТС', default=1, validators=[MinValueValidator(1)]
    )
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

    @cached_property
    def gallery(self):
        """Фото, файлы которых на месте.

        Фото из фикстуры лежат вне гита (лицензия чужая, D25): в чистом клоне
        записей о них нет файлов, и вместо них шаблон покажет заглушку.
        photos.all() берёт данные из prefetch_related, если он был.
        """
        return [photo for photo in self.photos.all() if photo.image.storage.exists(photo.image.name)]


class CarPhoto(models.Model):
    """Фото объявления. Первое по position — обложка в карточке."""

    car = models.ForeignKey(UsedCar, on_delete=models.CASCADE, related_name='photos', verbose_name='Автомобиль')
    image = models.ImageField('Файл', upload_to='cars/')
    position = models.PositiveSmallIntegerField('Порядок', default=0)

    class Meta:
        ordering = ['position', 'id']
        verbose_name = 'фото'
        verbose_name_plural = 'фото'

    def __str__(self):
        return f'Фото {self.position} — {self.car}'
