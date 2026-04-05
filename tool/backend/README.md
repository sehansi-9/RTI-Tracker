#### check sql/README.md file to seed the data

cd tool/backend
python -m venv .venv
source .venv/bin/activate

## install packages
uv sync

##run the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000