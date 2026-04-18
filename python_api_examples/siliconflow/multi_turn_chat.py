from config import DEFAULT_SYSTEM_PROMPT, build_client, build_parser


def main() -> None:
    parser = build_parser("SiliconFlow 多轮对话示例")
    parser.add_argument(
        "--follow-up",
        default="请再用一句话总结你的能力边界",
        help="第二轮追问内容。",
    )
    args = parser.parse_args()

    client = build_client(api_key=args.api_key, base_url=args.base_url)
    first_user = args.user or "你好，请介绍一下你自己"

    first_response = client.chat.completions.create(
        model=args.model,
        messages=[
            {"role": "system", "content": args.system or DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": first_user},
        ],
    )
    assistant_reply = first_response.choices[0].message.content or ""

    second_response = client.chat.completions.create(
        model=args.model,
        messages=[
            {"role": "system", "content": args.system or DEFAULT_SYSTEM_PROMPT},
            {"role": "user", "content": first_user},
            {"role": "assistant", "content": assistant_reply},
            {"role": "user", "content": args.follow_up},
        ],
    )

    print("第一轮回复:")
    print(assistant_reply)
    print("\n第二轮回复:")
    print(second_response.choices[0].message.content or "")


if __name__ == "__main__":
    main()
