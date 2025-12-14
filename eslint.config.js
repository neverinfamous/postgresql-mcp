import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
    { ignores: ['dist', 'node_modules'] },
    {
        extends: [
            js.configs.recommended,
            ...tseslint.configs.strictTypeChecked,
            ...tseslint.configs.stylisticTypeChecked,
        ],
        files: ['src/**/*.ts'],
        languageOptions: {
            ecmaVersion: 2022,
            globals: { ...globals.node },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            '@typescript-eslint/no-explicit-any': 'error',
            '@typescript-eslint/explicit-function-return-type': ['error', {
                allowExpressions: true,
                allowTypedFunctionExpressions: true,
                allowHigherOrderFunctions: true,
            }],
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-non-null-assertion': 'error',
            '@typescript-eslint/strict-boolean-expressions': ['error', {
                allowNullableBoolean: true,
                allowNullableString: true,
                allowNullableObject: true,
            }],
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/await-thenable': 'error',
            '@typescript-eslint/require-await': 'error',
            '@typescript-eslint/no-unnecessary-condition': 'off',
            '@typescript-eslint/no-unsafe-assignment': 'error',
            '@typescript-eslint/no-unsafe-member-access': 'error',
            '@typescript-eslint/no-unsafe-call': 'error',
            '@typescript-eslint/no-unsafe-return': 'error',
            '@typescript-eslint/no-unsafe-argument': 'error',
            '@typescript-eslint/consistent-type-imports': ['error', {
                prefer: 'type-imports',
                fixStyle: 'inline-type-imports',
            }],
            '@typescript-eslint/consistent-type-exports': 'error',
            'no-console': 'off',
        },
    },
)
