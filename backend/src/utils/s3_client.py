"""
Клиент для работы с Яндекс Object Storage через S3 API.

Этот модуль предоставляет функции для загрузки, удаления, переименования
и получения списка файлов в облачном хранилище S3.
Используется для хранения медиа-файлов проектов: фонов, спрайтов, музыки, обложек.

Зависимости:
    - boto3 (AWS SDK для Python, совместим с S3-совместимыми хранилищами)
    - python-dotenv (для загрузки переменных окружения)
"""

import os
import uuid
import boto3
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

# Конфигурация подключения к Яндекс Object Storage
# Учетные данные хранятся в переменных окружения, не в коде
s3_access_key = os.getenv("S3_ACCESS_KEY")
s3_secret_key = os.getenv("S3_SECRET_KEY")
s3_bucket_name = os.getenv("S3_BUCKET_NAME", "visual-novel-files")
s3_endpoint = "https://storage.yandexcloud.net"
s3_public_url = f"https://{s3_bucket_name}.storage.yandexcloud.net"

# Инициализация клиента S3
# В случае отсутствия ключей, клиент не создается (работает в режиме локального хранилища)
s3_client = None
if s3_access_key and s3_secret_key:
    s3_client = boto3.client(
        's3',
        endpoint_url=s3_endpoint,
        aws_access_key_id=s3_access_key,
        aws_secret_access_key=s3_secret_key,
        region_name='ru-central1'
    )


def is_s3_available() -> bool:
    """
    Проверяет доступность S3 хранилища.

    Returns:
        bool: True если S3 клиент инициализирован и доступен
    """
    return s3_client is not None


def get_file_type(file_name: str) -> str:
    """
    Определяет тип файла по его расширению.

    Args:
        file_name: Имя файла с расширением

    Returns:
        str: Тип файла ('audio', 'video' или 'image')
    """
    name = file_name.lower()
    if name.endswith('.mp3'):
        return "audio"
    elif name.endswith('.mp4'):
        return "video"
    return "image"


def get_content_type(file_name: str) -> str:
    """
    Определяет MIME-тип файла для корректной загрузки в S3.

    Args:
        file_name: Имя файла с расширением

    Returns:
        str: MIME-тип файла
    """
    name = file_name.lower()
    if name.endswith('.png'):
        return "image/png"
    elif name.endswith(('.jpg', '.jpeg')):
        return "image/jpeg"
    elif name.endswith('.mp3'):
        return "audio/mpeg"
    elif name.endswith('.mp4'):
        return "video/mp4"
    return "application/octet-stream"


def generate_unique_name(file_name: str, folder: str = "projects") -> str:
    """
    Генерирует уникальное имя файла в указанной папке S3.
    Проверяет существующие файлы и добавляет счетчик при конфликте.

    Args:
        file_name: Исходное имя файла
        folder: Папка в бакете S3

    Returns:
        str: Уникальное имя файла
    """
    if not is_s3_available():
        return file_name

    prefix = folder if folder.endswith('/') else f"{folder}/"
    base_name = os.path.splitext(file_name)[0]
    ext = os.path.splitext(file_name)[1]

    # Получаем список существующих файлов в папке
    existing_names = set()
    try:
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix=prefix,
            MaxKeys=1000
        )
        for obj in response.get('Contents', []):
            name = obj['Key'].split('/')[-1]
            if name:
                existing_names.add(name.lower())
    except Exception:
        pass

    # Если имя свободно — используем его
    if file_name.lower() not in existing_names:
        return file_name

    # Иначе добавляем счетчик до получения уникального имени
    counter = 1
    while True:
        new_name = f"{base_name}_{counter}{ext}"
        if new_name.lower() not in existing_names:
            return new_name
        counter += 1


def upload_file(file_data: bytes, file_name: str, folder: str = "projects") -> dict:
    """
    Загружает файл в Object Storage с автоматической генерацией уникального имени.

    Args:
        file_data: Бинарные данные файла
        file_name: Имя файла
        folder: Папка для загрузки в бакете

    Returns:
        dict: Результат загрузки с полями success, url, file_id, name и другими
    """
    if not is_s3_available():
        return {
            "success": False,
            "error": "S3 хранилище недоступно. Проверьте переменные окружения S3_ACCESS_KEY и S3_SECRET_KEY"
        }

    try:
        unique_name = generate_unique_name(file_name, folder)
        object_key = f"{folder}/{unique_name}"
        content_type = get_content_type(file_name)

        s3_client.put_object(
            Bucket=s3_bucket_name,
            Key=object_key,
            Body=file_data,
            ContentType=content_type,
            ACL='public-read'
        )

        url = f"{s3_public_url}/{object_key}"

        return {
            "success": True,
            "url": url,
            "file_id": unique_name.replace('.', '_'),
            "name": unique_name,
            "original_name": file_name,
            "size": len(file_data),
            "file_type": get_file_type(file_name),
            "object_key": object_key
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def rename_file(old_name: str, new_name: str, folder: str = "projects") -> dict:
    """
    Переименовывает файл в S3 путем копирования с новым именем и удаления старого.

    Args:
        old_name: Текущее имя файла
        new_name: Новое имя файла
        folder: Папка в бакете

    Returns:
        dict: Результат операции
    """
    if not is_s3_available():
        return {"success": False, "error": "S3 хранилище недоступно"}

    try:
        prefix = folder if folder.endswith('/') else f"{folder}/"

        # Находим старый файл
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix=prefix,
            MaxKeys=1000
        )

        old_key = None
        old_size = 0
        for obj in response.get('Contents', []):
            name_in_s3 = obj['Key'].split('/')[-1]
            if name_in_s3 == old_name:
                old_key = obj['Key']
                old_size = obj['Size']
                break

        if not old_key:
            return {"success": False, "error": "Исходный файл не найден"}

        # Добавляем расширение к новому имени, если отсутствует
        if not os.path.splitext(new_name)[1]:
            new_name = new_name + os.path.splitext(old_name)[1]

        # Проверяем уникальность нового имени
        new_name = generate_unique_name(new_name, folder)
        new_key = f"{folder}/{new_name}"

        # Копируем объект с новым ключом
        copy_source = f"{s3_bucket_name}/{old_key}"
        s3_client.copy_object(
            Bucket=s3_bucket_name,
            CopySource=copy_source,
            Key=new_key,
            ACL='public-read'
        )

        # Удаляем старый объект
        s3_client.delete_object(Bucket=s3_bucket_name, Key=old_key)

        new_url = f"{s3_public_url}/{new_key}"

        return {
            "success": True,
            "name": new_name,
            "url": new_url,
            "size": old_size,
            "type": get_file_type(new_name)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


def delete_file_by_name(file_name: str, folder: str = "projects") -> dict:
    """
    Удаляет файл из S3 по его имени в указанной папке.

    Args:
        file_name: Имя файла для удаления
        folder: Папка в бакете

    Returns:
        dict: Результат операции
    """
    if not is_s3_available():
        return {"success": True}

    try:
        prefix = folder if folder.endswith('/') else f"{folder}/"
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix=prefix,
            MaxKeys=1000
        )

        for obj in response.get('Contents', []):
            if obj['Key'] == prefix:
                continue
            if obj['Key'].split('/')[-1] == file_name:
                s3_client.delete_object(Bucket=s3_bucket_name, Key=obj['Key'])
                return {"success": True}

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def delete_file_by_url(url: str) -> dict:
    """
    Удаляет файл из S3 по его полному URL.

    Args:
        url: Полный URL файла в S3

    Returns:
        dict: Результат операции
    """
    if not is_s3_available():
        return {"success": True}

    try:
        if not url or s3_public_url not in url:
            return {"success": True}
        object_key = url.replace(f"{s3_public_url}/", "")
        s3_client.delete_object(Bucket=s3_bucket_name, Key=object_key)
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}


def list_files(folder: str = "projects") -> dict:
    """
    Получает список всех файлов в указанной папке S3.

    Args:
        folder: Папка в бакете

    Returns:
        dict: Список файлов с метаданными
    """
    if not is_s3_available():
        return {"success": True, "files": []}

    try:
        prefix = folder if folder.endswith('/') else f"{folder}/"
        response = s3_client.list_objects_v2(
            Bucket=s3_bucket_name,
            Prefix=prefix,
            MaxKeys=1000
        )

        files = []
        for obj in response.get('Contents', []):
            key = obj['Key']
            if key == prefix:
                continue
            name = key.split('/')[-1]
            if not name:
                continue

            files.append({
                "id": name.replace('.', '_'),
                "name": name,
                "url": f"{s3_public_url}/{key}",
                "type": get_file_type(name),
                "size": obj['Size'],
                "file_id": name.replace('.', '_'),
                "object_key": key
            })

        return {"success": True, "files": files}
    except Exception as e:
        return {"success": False, "files": [], "error": str(e)}


def delete_file_and_cleanup(file_name: str, folder: str, db_session, project_id: int) -> dict:
    """
    Удаляет файл из S3 и очищает все ссылки на него в сценах проекта.

    Args:
        file_name: Имя файла для удаления
        folder: Папка в бакете
        db_session: Сессия базы данных
        project_id: Идентификатор проекта

    Returns:
        dict: Результат операции
    """
    from src.scenes import crud as scenes_crud

    # Удаляем файл из S3
    result = delete_file_by_name(file_name, folder)

    if not result["success"]:
        return result

    # Определяем тип ресурса по имени папки
    resource_type = folder.split('/')[-1] if '/' in folder else folder

    # Получаем все сцены проекта для очистки ссылок
    scenes = scenes_crud.get_project_scenes(db_session, project_id)

    for scene in scenes:
        nodes = scenes_crud.get_nodes_by_scene(db_session, scene.id)
        updated = False

        for node in nodes:
            if resource_type == 'backgrounds':
                if scene.background_url and file_name in scene.background_url:
                    scene.background_url = None
                    scene.background_type = 'image'
                    updated = True

            if resource_type == 'sprites':
                if node.sprite_file and file_name in node.sprite_file:
                    node.sprite_file = ''
                    updated = True

            if resource_type == 'music':
                if node.music_file and file_name in node.music_file:
                    node.music_file = ''
                    updated = True

        if updated:
            db_session.commit()

    return {"success": True, "message": "Файл удален и ссылки очищены"}