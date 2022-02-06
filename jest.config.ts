function makeConfig(name: string) {
  return {
    displayName: name,
    testEnvironment: 'jsdom',
    testMatch: [`<rootDir>/packages/${name}/**/*.test.[jt]s?(x)`],
    setupFilesAfterEnv: [`<rootDir>/packages/${name}/__tests__/jest.setup.js`],
    snapshotFormat: {
      printBasicPrototype: false,
    },
  }
}

module.exports = {
  projects: [
    makeConfig('react-virtual'),
  ],
}
