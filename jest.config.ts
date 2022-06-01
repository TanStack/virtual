const path = require('path')
const { lstatSync, readdirSync } = require('fs')

// get listing of packages in the mono repo
const basePath = path.resolve(__dirname, 'packages')

const packages = readdirSync(basePath).filter((name) => {
  return lstatSync(path.join(basePath, name)).isDirectory()
})

const { namespace } = require('./package.json')

const moduleNameMapper = {
  ...packages.reduce(
    (acc, name) => ({
      ...acc,
      [`${namespace}/${name}(.*)$`]: `<rootDir>/packages/./${name}/src/$1`,
    }),
    {},
  ),
}

module.exports = {
  projects: [
    {
      displayName: 'virtual-core',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/virtual-core/**/*.test.[jt]s?(x)'],
      setupFilesAfterEnv: [
        '<rootDir>/packages/virtual-core/__tests__/jest.setup.js',
      ],
      snapshotFormat: {
        printBasicPrototype: false,
      },
      moduleNameMapper,
    },
    {
      displayName: 'react-virtual',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/packages/react-virtual/**/*.test.[jt]s?(x)'],
      setupFilesAfterEnv: [
        '<rootDir>/packages/react-virtual/__tests__/jest.setup.js',
      ],
      snapshotFormat: {
        printBasicPrototype: false,
      },
      moduleNameMapper,
    },
  ],
}
