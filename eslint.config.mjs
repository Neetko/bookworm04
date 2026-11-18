import { FlatCompat } from "@eslint/eslintrc"
import { dirname } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const config = [
	{
		ignores: [
			"**/.next/**",
			"**/.output/**",
			"**/.tanstack/**",
			"**/node_modules/**",
			"**/dist/**",
			"**/routeTree.gen.ts",
			"**/drizzle/**",
			"**/supabase/**",
		],
	},
	...compat.extends("next/core-web-vitals"),
	{
		files: ["apps/start/**/*.{ts,tsx}"],
		rules: {
			"@next/next/no-head-element": "off",
		},
	},
]

export default config
