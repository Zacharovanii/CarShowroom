from django import forms
from django.utils import timezone

from .models import UsedCar


class UsedCarForm(forms.ModelForm):
    """Объявление от посетителя. Публикации в форме нет: решает менеджер."""

    # Короткие поля шаблон ставит по два в ряд, остальные — на всю ширину
    half_width_fields = ['year', 'mileage_km', 'owners_count', 'price']

    class Meta:
        model = UsedCar
        fields = ['brand', 'model', 'year', 'mileage_km', 'owners_count', 'price', 'features', 'description']
        widgets = {
            'features': forms.CheckboxSelectMultiple,
            'description': forms.Textarea(attrs={'rows': 4}),
        }
        help_texts = {
            'model': 'Например: X5 xDrive30d',
            'price': 'Цена в рублях, за которую вы готовы продать автомобиль',
            'description': 'Состояние, история обслуживания, комплект шин — всё, что важно покупателю',
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Пустой пункт списка у Django 6.1 не переведён («Select an option»)
        self.fields['brand'].empty_label = 'Выберите марку'
        # Классы Bootstrap вешаются здесь, чтобы шаблон не перечислял поля
        for field in self.fields.values():
            widget = field.widget
            if isinstance(widget, (forms.CheckboxInput, forms.CheckboxSelectMultiple)):
                widget.attrs['class'] = 'form-check-input'
            elif isinstance(widget, forms.Select):
                widget.attrs['class'] = 'form-select'
            else:
                widget.attrs['class'] = 'form-control'

    def full_clean(self):
        super().full_clean()
        # Поле с ошибкой подсвечивается красным (класс is-invalid в Bootstrap)
        for name in self.errors:
            if name in self.fields:
                self.fields[name].widget.attrs['class'] += ' is-invalid'

    def clean_year(self):
        year = self.cleaned_data['year']
        if year > timezone.localdate().year:
            raise forms.ValidationError('Год выпуска не может быть в будущем.')
        return year


class UsedCarEditForm(UsedCarForm):
    """Редактирование сотрудником: те же поля плюс публикация."""

    class Meta(UsedCarForm.Meta):
        fields = UsedCarForm.Meta.fields + ['is_published']
