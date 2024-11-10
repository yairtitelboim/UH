import asyncio
from googlemaps import Client as GoogleMapsClient
import os
from datetime import datetime

class ImageCollector:
    def __init__(self, config):
        self.satellite_client = GoogleMapsClient(key=config['google_maps_api_key'])
        self.street_view_client = GoogleMapsClient(key=config['google_maps_api_key'])
        self.cache_dir = os.path.join(os.getcwd(), 'cache', 'images')
        os.makedirs(self.cache_dir, exist_ok=True)

    async def collect_images(self, address: str) -> dict:
        # Validate address
        geocode_result = self.satellite_client.geocode(address)
        if not geocode_result:
            raise ValueError(f"Invalid address: {address}")
        
        location = geocode_result[0]['geometry']['location']
        
        # Collect different view types
        images = {
            'satellite': await self._fetch_and_cache('satellite', location),
            'aerial_45deg': await self._fetch_and_cache('45deg', location),
            'street_view': await self._fetch_and_cache('street_view', location)
        }
        
        return images

    async def _fetch_and_cache(self, image_type: str, location: dict) -> str:
        cache_key = f"{location['lat']}_{location['lng']}_{image_type}"
        cache_path = os.path.join(self.cache_dir, f"{cache_key}.jpg")
        
        if os.path.exists(cache_path):
            return cache_path
            
        # Fetch new image based on type
        if image_type == 'satellite':
            image_data = self.satellite_client.static_map(
                center=location,
                zoom=18,
                size=(800, 800),
                maptype='satellite'
            )
        elif image_type == '45deg':
            image_data = self.satellite_client.static_map(
                center=location,
                zoom=18,
                size=(800, 800),
                maptype='satellite',
                heading=45
            )
        else:  # street_view
            image_data = self.street_view_client.street_view(
                location=location,
                size=(800, 400)
            )
            
        # Save to cache
        with open(cache_path, 'wb') as f:
            f.write(image_data)
            
        return cache_path
