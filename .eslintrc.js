module.exports = {
    'env': {
        'browser': true,
        'es6': true,
        'node': false
    },
    'extends': 'eslint:recommended',
    'parser': 'babel-eslint',
    'parserOptions': {
        'sourceType': 'module'
    },
    'rules': {
        'indent': [ 'error', 4 ],
        'linebreak-style': [ 'error', 'unix' ],
        'quotes': [ 'error', 'single' ],
        'semi': [ 'error', 'always' ],
        'eqeqeq': [ 'error', 'always' ],
    }
};