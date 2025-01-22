from dotenv import load_dotenv
import os
load_dotenv()
class Config:
    GROQ_AI_KEY = os.environ.get('GROQ_AI_KEY')
    OPEN_AI_KEY= os.environ.get('OPEN_AI_KEY')
    OPEN_AI_ORG= os.environ.get('OPEN_AI_ORG')