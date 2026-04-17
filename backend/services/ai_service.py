import random
import asyncio
from logger import logger
from secret_manager import get_secret

class AIService:
    """
    Simulates integration with Google Gemini for real-time crowd intelligence.
    Provides predictive wait times and density analysis based on live telemetry.
    """
    def __init__(self):
        self.api_key = get_secret("GEMINI_API_KEY")
        self.model_name = "gemini-1.5-flash"

    async def predict_wait_time(self, current_queue_size, zone_type):
        """
        AI-powered wait time prediction.
        Simulates an LLM call adjusting for zone-specific bottlenecks.
        """
        # Logic simulates what an LLM would deduce from venue context
        base_minutes = 3.0
        if zone_type == "food":
            base_minutes = 5.5
        elif zone_type == "gate":
            base_minutes = 2.0
            
        # Simulate slight AI latency (50-200ms)
        await asyncio.sleep(random.uniform(0.05, 0.2))
        
        predicted = current_queue_size * base_minutes
        
        # Add a "jitter" factor representing AI volatility/realism
        jitter = random.uniform(0.9, 1.1)
        return round(predicted * jitter, 1)

    async def analyze_crowd_density(self, reports_count, reports_type):
        """
        Calculates a 'Crowd Density Score' (0-10) using AI-weighted logic.
        Higher priority for 'crowded' reports compared to 'clear' reports.
        """
        # Simulate an LLM evaluating the sentiment and volume of reports
        if reports_type == "crowded":
            score_impact = reports_count * 1.5
        else:
            score_impact = -reports_count * 0.8
            
        # Simulate local "inference"
        await asyncio.sleep(0.05)
        
        return score_impact

# Global singleton
ai_service = AIService()
