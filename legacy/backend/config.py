from dotenv import load_dotenv
load_dotenv()
class Config:
    GROQ_AI_KEY = os.environ.get('GROQ_AI_KEY')