from django import template

register = template.Library()

NBSP = ' '  # неразрывный пробел: «3 290 000 ₽» не переносится по частям


def group_digits(value):
    """12345678 → «12 345 678» (разряды через неразрывный пробел)."""
    return f'{int(value):,}'.replace(',', NBSP)


@register.filter
def rub(value):
    """Цена в рублях без копеек: Decimal('3290000.00') → «3 290 000 ₽»."""
    return f'{group_digits(value)}{NBSP}₽'


@register.filter
def km(value):
    """Пробег: 98000 → «98 000 км»."""
    return f'{group_digits(value)}{NBSP}км'
