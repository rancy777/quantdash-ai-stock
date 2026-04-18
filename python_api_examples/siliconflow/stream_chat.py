from config import DEFAULT_SYSTEM_PROMPT, build_client, build_parser


DEFAULT_USER_PROMPT = "请用三点介绍硅基流动 OpenAI 兼容接口的调用方式"


def main() -> None:
    parser = build_parser("SiliconFlow 流式输出示例")
    args = parser.parse_args()

    client = build_client(api_key=args.api_key, base_url=args.base_url)
    stream = client.chat.completions.create(
        model=args.model,
        stream=True,
        messages=[
            {"role": "system", "content": args.system or DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": args.user or DEFAULT_USER_PROMPT},
        ],
    )

    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices else None
        if delta:
            print(delta, end="", flush=True)
    print()


if __name__ == "__main__":
    main()
