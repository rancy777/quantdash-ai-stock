from config import DEFAULT_SYSTEM_PROMPT, build_client, build_parser


DEFAULT_USER_PROMPT = "你好，请介绍一下你自己"


def main() -> None:
    parser = build_parser("SiliconFlow 普通对话示例")
    args = parser.parse_args()

    client = build_client(api_key=args.api_key, base_url=args.base_url)
    response = client.chat.completions.create(
        model=args.model,
        messages=[
            {"role": "system", "content": args.system or DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": args.user or DEFAULT_USER_PROMPT},
        ],
    )
    print(response.choices[0].message.content or "")


if __name__ == "__main__":
    main()
