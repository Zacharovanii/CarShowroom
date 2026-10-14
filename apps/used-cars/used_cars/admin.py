from django.contrib import admin
from django.db.models import Count

from .models import Brand, Feature, UsedCar

admin.site.site_header = 'CarShowroom — авто с пробегом'
admin.site.site_title = 'Авто с пробегом'


@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('name', 'country', 'cars_count')
    list_filter = ('country',)
    search_fields = ('name',)
    ordering = ('name',)

    def get_queryset(self, request):
        # Число объявлений считает БД одним запросом, а не по запросу на марку
        return super().get_queryset(request).annotate(cars_count=Count('cars'))

    @admin.display(description='Объявлений', ordering='cars_count')
    def cars_count(self, obj):
        return obj.cars_count


@admin.register(Feature)
class FeatureAdmin(admin.ModelAdmin):
    search_fields = ('name',)


@admin.register(UsedCar)
class UsedCarAdmin(admin.ModelAdmin):
    list_display = (
        'model', 'brand', 'year', 'mileage_km', 'owners_count', 'price', 'is_published', 'created_at'
    )
    list_display_links = ('model',)
    list_filter = ('is_published', 'brand', 'year')
    search_fields = ('model', 'description', 'brand__name')
    # Модерация прямо из списка: галочка «Опубликовано» и цена
    list_editable = ('price', 'is_published')
    ordering = ('-created_at',)
    filter_horizontal = ('features',)
    list_select_related = ('brand',)
    actions = ('publish', 'unpublish')

    @admin.action(description='Опубликовать выбранные')
    def publish(self, request, queryset):
        updated = queryset.update(is_published=True)
        self.message_user(request, f'Опубликовано объявлений: {updated}')

    @admin.action(description='Снять с публикации')
    def unpublish(self, request, queryset):
        updated = queryset.update(is_published=False)
        self.message_user(request, f'Снято с публикации: {updated}')
