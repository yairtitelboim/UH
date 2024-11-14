from setuptools import setup, find_packages

setup(
    name="atlas",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        'aiohttp==3.9.1',
        'anthropic==0.7.1',
        'python-dotenv==1.0.0',
        'pytest==7.4.3',
        'pytest-asyncio==0.21.1',
        'pytest-mock==3.12.0',
        'pandas==2.1.0',
        'numpy==1.24.0',
        'backoff==2.2.1',
        'prometheus-client==0.17.1',
        'httpx==0.27.0'
    ]
) 