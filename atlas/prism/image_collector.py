import asyncio
from googlemaps import Client as GoogleMapsClient
import os
from datetime import datetime
from typing import Dict, Optional
from dotenv import load_dotenv
import logging

load_dotenv()  # Load environment variables

class ImageCollector:
    MAX_RETRIES = 3
    RETRY_DELAY = 1

    def __init__(self, config: Dict):
        self.api_key = config['google_maps_api_key']
        self.cache_dir = config['cache_dir']
        self.client = GoogleMapsClient(self.api_key)
        self.logger = logging.getLogger(__name__)

    async def collect_images(self, address: str, include_45deg: bool = False) -> Dict[str, str]:
        try:
            geocode_result = await self.client.geocode(address)
            if not geocode_result:
                raise ValueError(f"Could not geocode address: {address}")
            
            location = geocode_result[0]['geometry']['location']
            
            tasks = [
                self._fetch_and_cache('satellite', location),
                self._fetch_and_cache('street_view', location)
            ]
            
            if include_45deg:
                tasks.append(self._fetch_and_cache('45deg', location))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Check for exceptions
            for result in results:
                if isinstance(result, Exception):
                    raise result
            
            response = {
                'satellite': results[0],
                'street_view': results[1]
            }
            
            if include_45deg:
                response['45deg'] = results[2]
                
            return response

        except Exception as e:
            if isinstance(e, ValueError):
                raise
            if "OVER_QUERY_LIMIT" in str(e):
                raise Exception("Rate limit exceeded")
            if "Permission denied" in str(e):
                raise Exception(f"Cannot access cache directory: {self.cache_dir}")
            raise Exception(f"Failed to collect images: {str(e)}")

    async def _fetch_and_cache(self, image_type: str, location: dict, retry_count: int = 0) -> str:
        try:
            cache_key = f"{location['lat']}_{location['lng']}_{image_type}"
            cache_path = os.path.join(self.cache_dir, f"{cache_key}.jpg")

            if os.path.exists(cache_path):
                return cache_path

            # Fetch new image with retry logic
            for attempt in range(self.MAX_RETRIES):
                try:
                    image_data = await self._fetch_image(image_type, location)
                    break
                except Exception as e:
                    if attempt == self.MAX_RETRIES - 1:
                        raise
                    await asyncio.sleep(self.RETRY_DELAY * (attempt + 1))

            # Ensure the cache directory exists
            os.makedirs(self.cache_dir, exist_ok=True)
            
            # Save the image
            with open(cache_path, 'wb') as f:
                f.write(image_data)

            return cache_path

        except Exception as e:
            raise Exception(f"Failed to fetch and cache {image_type} image: {str(e)}")

    async def _fetch_image(self, image_type: str, location: dict) -> bytes:
        if image_type in ['satellite', '45deg']:
            return await self.client.static_map(
                center=location,
                zoom=18 if image_type == 'satellite' else 19,
                size=(800, 800),
                maptype='satellite'
            )
        else:  # street_view
            return await self.client.street_view(
                location=location,
                size=(800, 400)
            )

    async def get_satellite_image(self, address: str) -> Dict:
        """Get satellite image for address"""
        try:
            result = await self.client.places(address)
            return {
                'status': 'OK',
                'data': result['satellite_image']
            }
        except Exception as e:
            raise ValueError(f"Failed to get satellite image: {str(e)}")

    async def get_street_view(self, address: str) -> Dict:
        """Get street view image for address"""
        try:
            result = await self.client.streetview(address)
            return {
                'status': 'OK',
                'data': result['image']
            }
        except Exception as e:
            raise ValueError(f"Failed to get street view: {str(e)}")
