import json
import httpx
import asyncio

EVOLUTION_URL="https://evolution-viajesnea.agentech.ar"
EVOLUTION_API_KEY="429683C4C977415CAAFCCE10F7D57E11"
PUBLIC_WEBHOOK="https://api.viajesnea.agentech.ar/api/v1/webhooks/evolution"

async def update_webhook():
    headers = {
        "apikey": EVOLUTION_API_KEY,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        # Get instances
        res = await client.get(f"{EVOLUTION_URL}/instance/fetchInstances", headers=headers)
        if res.status_code != 200:
            print("Failed to fetch instances", res.text)
            return
        
        instances = res.json()
        print(f"Found {len(instances)} instances")
        
        for instance in instances:
            name = instance.get("instance", {}).get("instanceName")
            if not name:
                name = instance.get("instanceName") or instance.get("name")
            print(f"Updating webhook for instance: {name}")
            
            payload = {
                "webhook": {
                    "enabled": True,
                    "url": PUBLIC_WEBHOOK,
                    "events": [
                        "MESSAGES_UPSERT"
                    ]
                }
            }
            # For Revolution/Evolution API, setting webhook usually happens via POST or PUT to /webhook/set/{instance}
            w_res = await client.post(f"{EVOLUTION_URL}/webhook/set/{name}", headers=headers, json=payload)
            if w_res.status_code in (200, 201):
                print(f"Webhook config updated successfully to {PUBLIC_WEBHOOK}\nResponse:", json.dumps(w_res.json(), indent=2))
            else:
                print(f"Failed to set webhook for {name}:", w_res.text)

if __name__ == "__main__":
    asyncio.run(update_webhook())
