# @icon-collection/synonyms

- 日本語 / 英語の同義語辞書 (`dictionaries/ja.json`, `dictionaries/en.json`)
- スキーマ検証 (`validateDictionary`)
- 辞書ロード API (`loadDictionary(lang)`)

辞書に語を追加する際は `SynonymEntry` の 3 フィールド `term`, `expansion`, `lang` を必ず埋めること。重み付けが必要なら `weight` を任意で付ける。
