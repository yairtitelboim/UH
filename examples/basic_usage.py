import asyncio
from atlas import ATLAS

async def main():
    # Initialize ATLAS
    atlas = ATLAS()
    
    # Analyze a property
    address = "2020 12th St NW, Washington, DC"
    results = await atlas.analyze_property(address)
    
    # Print results
    print("Analysis Results:")
    print(f"Zoning Data: {results['zoning_data']}")
    print(f"Sources found: {len(results['search_results'].get('sources', []))}")
    print(f"Processed metrics: {results['processed_data']['metrics']}")
    print(f"Analysis: {results['analysis_results']}")
    print(f"Market Analysis: {results['market_analysis']}")

if __name__ == "__main__":
    asyncio.run(main()) 