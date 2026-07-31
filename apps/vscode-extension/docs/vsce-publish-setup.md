# VSCE Publish (Azure OIDC) セットアップ手順

Marketplace publish 用 PAT の代わりに Azure AD の federated credential を使い、GitHub Actions から短命トークンを取得して `vsce publish` を叩く方法。

## 前提

- Azure AD テナントに管理者権限
- Marketplace publisher `kage1020` の owner 権限
- Repo secrets を編集できる権限

## 手順

1. Azure Portal で App registration を新規作成 (例: `icon-collection-vsce-publish`)
2. **Certificates & secrets → Federated credentials → Add credential**
   - Scenario: `GitHub Actions deploying Azure resources`
   - Organization: `kage1020`
   - Repository: `IconCollection`
   - Entity type: `Tag`
   - Tag pattern: `v*.*.*` (もしくは `refs/tags/v*.*.*`)
   - Name: `github-tag-publish`
3. Azure DevOps organization `kage1020` (Marketplace 発行に使う組織) にこの App registration を Service Principal として追加
4. Marketplace publisher `kage1020` に Service Principal を Contributor で招待
5. GitHub Actions で以下 secrets を登録:
   - `AZURE_CLIENT_ID`: App registration の Application (client) ID
   - `AZURE_TENANT_ID`: Directory (tenant) ID
   - Azure DevOps org 名 (例 `kage1020`) と publisher (`kage1020`) は workflow YAML に直接埋め込む
6. Marketplace 側で publisher に対して `Manage Publisher` 権限を Service Principal に付与 (Marketplace UI から)
7. tag を push (`git tag v0.2.0 && git push origin v0.2.0`) すると workflow が発火

## Rollback / トラブルシュート

- Federated credential の subject が tag pattern と一致しない場合、`AADSTS70021` エラー。credential の Entity type を Tag、Pattern を `v*.*.*` (glob) に設定
- `vsce publish` の 401 は Service Principal の Marketplace 権限不足。publisher UI で権限を再確認
- PAT に fallback したい場合は `.github/workflows/vsce-publish.yml` の環境変数を `VSCE_PAT` にする専用 workflow を退避で用意しておく (このリポジトリでは廃止方針)
