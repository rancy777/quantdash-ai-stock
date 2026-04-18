from server.app import APP


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        APP,
        host="0.0.0.0",
        port=7878,
        reload=False,
    )
