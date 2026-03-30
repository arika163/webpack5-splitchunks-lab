const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const TerserPlugin = require('terser-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = {
  entry: { 
    entry1: path.resolve(__dirname, './src/entry1.js'),
    entry2: path.resolve(__dirname, './src/entry2.js'),
    entry3: path.resolve(__dirname, './src/entry3.js')
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash:8].js',
    clean: true,
    publicPath: '/'
  },
  resolve: {
    extensions: ['.js', '.json']
  },
  module: {
    rules: []
  },
  plugins: (() => {
    const p = [
      new HtmlWebpackPlugin({
        template: path.resolve(__dirname, 'public', 'index.html')
      }),
      new HtmlInlineScriptPlugin({
        scriptMatchPattern: [/runtime\.[a-z0-9]{8}\.js$/]
      })
    ];

    if (process.env.ANALYZE === 'true') {
      p.push(new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: true,
        reportFilename: 'bundle-report.html'
      }));
    }

    return p;
  })(),
  optimization: {
    runtimeChunk: 'single',
    minimizer: [
      new TerserPlugin({
        extractComments: false
      }),
    ],
    splitChunks: {
      /**
       * 控制哪些 chunk 会被考虑做切分：
       * "async" 只处理按需加载（dynamic import()）产生的异步 chunk（webpack4 的默认行为）。
       * 还有 "initial"（只处理入口 chunk）和 "all"（处理所有 chunk，包括初始 + 异步）。
       * 
       * 测试值：initial async all
       */
      chunks: "all",
      /**
       * `minSize: 20000` 表示：要生成一个新的分离 chunk，模块集合的总字节数必须至少为 20000 字节（≈20KB）。
       * 若小于 minSize 则不会拆分出单独文件（目的是避免过多小文件）。
       * 
       * 测试值：20000 2000000
       * 单位：字节
       */ 
      minSize: 20000,
      /**
       * 含义：在把一部分从原 chunk 抽成新 chunk 后，原 chunk 剩余的字节数必须 ≥ minRemainingSize，
       * 防止“拆出一小块导致原 chunk 变得极小（几字节）”的问题。
       * 在 webpack4 中没有这个选项（或不常用）；webpack5 增加了它以避免产生零长度/极小的残留 chunk。
       * 
       * 测试值：0 10000 (测试时需要使用单entry，enforceSizeThreshold为500000000)
       * 单位：字节
       */
      minRemainingSize: 0,
      /**
       * 要把某个模块抽成共享 chunk，模块至少被多少个 chunk 引用（被多少次重复引用）。
       * minChunks:1 表示只要出现一次就有资格（配合其它条件，如 minSize 等一起判断）。
       * 通常为了提取“真正的公共模块”会设置为 2 或更大。
       * 
       * 测试值：1 4
       */
      minChunks: 1,
      /**
       * 同时按需 (async) 请求可以并行加载的最大 chunk 数量。
       * 如果异步入口需要加载的切分文件超过这个值，Webpack 会尝试合并以降低并发请求数。
       * 值为 30 是较大的上限（默认在 webpack5 中为 30，webpack4 的默认更小）。
       * 
       * 测试值：30 1 （需要default组minChunks为1，需要单entry测试）
       */
      maxAsyncRequests: 30,
      /**
       * 页面初始加载时（entry）并行请求的最大 chunk 数。
       * 同样超出会导致合并以降低请求数。30 是较高的上限（注意：增加并行数会增加 HTTP 请求，视场景权衡）。
       * 
       * 测试值：30 1 (需要单entry测试)
       */
      maxInitialRequests: 30,
      /**
       * 含义：如果 chunk 的大小超过该阈值（字节），则会“强制”触发进一步分割，
       * 即使其他限制（比如 minChunks，minRemainingSize）没满足，也会进行切分以避免单个文件过大。
       * 
       * 测试值：1 500000000 （测试时需要把minRemainingSize设置为10000，需要单entry测试）
       */
      enforceSizeThreshold: 500000000,
      /**
       * 这是一个对象，按名称定义若干规则组（每个组决定哪些模块应该被抽成一个单独的 chunk）。
       * 每个组可以设置 test/priority/minSize/minChunks/reuseExistingChunk/name/enforce 等。
       */
      cacheGroups: {
        defaultVendors: {
          /**
           * 正则：匹配来自 node_modules 的模块。
           * 也就是说这个组会把第三方依赖（如 lodash、react 等）识别出来，按组策略抽成 vendors chunk。
           */
          test: /[\\/]node_modules[\\/]/,
          /**
           * 指定当前 cache group 生成的 chunk 名称
           * 1.提供字符串或函数可以让你使用自定义名称
           * 2.指定字符串或始终返回相同字符串的函数，会将所有拆分出来的内容并到一个代码块中。
           *   这可能会导致初始下载量增大，并减慢页面加载速度。
           * 3.如果提供的名称与某个entry相同，entry chunk 和该cache group将合并为一个单独的 chunk
           * 
           * 测试值：'vendors' 返回相同字符串的函数 返回不同字符串的函数 false
           */
          name: function (module, chunks, cacheGroupKey) {
            const chunkNames = Array.from(chunks)
              .map(chunk => chunk.name)
              .filter(Boolean)
              .join('~')

            return `vendors~${chunkNames}`;
          }, 
          /**
           * 优先级：当一个模块同时匹配多个 cache group 时，priority 更大的组优先处理（higher wins）。
           * 这里是 -10（较低优先级）。默认规则里通常会有 defaultVendors（优先级较高）和 default（较低）。
           * 
           * 测试值： -10 -30
           */
          priority: -10,
          /**
           * 如果已经存在一个符合条件的 chunk，则复用它
           * （作用不明，构造测试场景失败，暂时忽略）
           * 
           * 参考：https://github.com/webpack/webpack.js.org/issues/2122#issuecomment-388609306
           */
          reuseExistingChunk: true
        },
        default: {
          minChunks: 2,
          name: function (module, chunks, cacheGroupKey) {
            const chunkNames = Array.from(chunks)
              .map(chunk => chunk.name)
              .filter(Boolean)
              .join('~')

            return `${cacheGroupKey}~${chunkNames}`;
          },
          priority: -20,
          reuseExistingChunk: true
        },
      },
    }
  }
};