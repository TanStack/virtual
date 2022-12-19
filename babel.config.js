const { NODE_ENV, BABEL_ENV } = process.env
const cjs = NODE_ENV === 'test' || BABEL_ENV === 'commonjs'
const loose = true

module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        loose,
        modules: false,
      },
    ],
    '@babel/preset-typescript',
  ],
  plugins: [cjs && ['@babel/transform-modules-commonjs', { loose }]].filter(
    Boolean,
  ),
  overrides: [
    {
      include: ['./packages/react-virtual/**'],
      presets: ['@babel/preset-react'],
    },
    {
      include: './packages/solid-virtual/**',
      presets: ['babel-preset-solid'],
    },
  ],
}
