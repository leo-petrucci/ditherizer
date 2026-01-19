/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: 'ditherizer',
      removal: input?.stage === 'production' ? 'retain' : 'remove',
      home: 'aws',
    }
  },
  async run() {
    new sst.aws.TanStackStart('DitherizerWeb', {
      domain: {
        name: 'ditherizer.leonardo.petruc.ci',
        redirects: ['www.ditherizer.leonardo.petruc.ci'],
      },
    })
  },
})
