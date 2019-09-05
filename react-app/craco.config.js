const path = require('path');
const CracoAntDesignPlugin = require('craco-antd');

const esModules = ['kbase-ui-lib'].join('|');

module.exports = {
    jest: {
        babel: {
            addPresets: true,
            addPlugins: true,
            configure: (jestConfig, { env, paths, resolve, rootDir }) => {
                // jestConfig.transformIgnorePatterns = [`<rootDir>/node_modules/(?!${esModules})`];
                jestConfig.transformIgnorePatterns = ['[/\\\\]node_modules[/\\\\](?!kbase-ui-lib|antd/).+\\.js$'];
                jestConfig.rootDir = './src';

                return jestConfig;
            }
        }
    },
    plugins: [
        {
            plugin: CracoAntDesignPlugin,
            options: {
                customizeThemeLessPath: path.join(__dirname, 'node_modules/@kbase/ui-lib/lib/custom/antd/theme.less')
            }
        }
    ],
    webpack: {
        alias: {
            react: path.resolve('./node_modules/react'),
            redux: path.resolve('./node_modules/redux'),
            'react-redux': path.resolve('./node_modules/react-redux')
        }
    },
    devServer: {
        watchOptions: {
            poll: 1000
        }
    }
};
