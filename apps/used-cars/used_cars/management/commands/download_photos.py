"""Скачивает фото объявлений из фикстуры с Unsplash в media/.

Сами фото в гит не попадают (D25), в репозитории только список источников
used_cars/photo_sources.json: «путь в media → адрес на Unsplash». Уже скачанные
файлы пропускаются, поэтому команду можно запускать повторно.
"""
import json
import urllib.request
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

SOURCES = Path(__file__).resolve().parents[2] / 'photo_sources.json'
# Unsplash отдаёт картинку нужного размера сам: 2048 px по ширине, JPEG, качество 85
SIZE_PARAMS = '?w=2048&q=85&fm=jpg'


class Command(BaseCommand):
    help = 'Скачать фото объявлений из фикстуры (Unsplash) в папку media/'

    def handle(self, *args, **options):
        sources = json.loads(SOURCES.read_text(encoding='utf-8'))
        downloaded = 0
        for name, url in sources.items():
            target = Path(settings.MEDIA_ROOT) / name
            if target.exists():
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            request = urllib.request.Request(url + SIZE_PARAMS, headers={'User-Agent': 'CarShowroom/1.0'})
            with urllib.request.urlopen(request, timeout=60) as response:
                target.write_bytes(response.read())
            downloaded += 1
            self.stdout.write(f'{name}  {target.stat().st_size // 1024} КБ')
        self.stdout.write(self.style.SUCCESS(f'Скачано: {downloaded}, уже было: {len(sources) - downloaded}'))
