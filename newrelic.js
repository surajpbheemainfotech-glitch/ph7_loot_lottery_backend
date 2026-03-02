'use strict';

export const config = {
  app_name: ['Loot Lottery Backend'],
  license_key:`  ${process.env.NEWRELIC_LICENSE_KEY}`,
  logging: {
    level: 'info',
  },
  application_logging: {
    forwarding: {
      enabled: false,
    },
  },
};