const {
  getSelectionText,
  getMethodUrl,
  wordToUpperCase,
  sortKey,
  formatData,
  deepGet,
  deepSet,
  blobTool,
  getAbsolutePosition,
  debounce,
} = window.utils

window.HttpShow = (() => {
  const {
    useState,
    useEffect,
    useRef,
  } = React
  const {
    Collapse,
    Button,
    Tag,
    Tabs,
    BackTop,
    message,
    Spin,
  } = window.antd

  const { Panel } = Collapse;
  const { TabPane } = Tabs;

  const {
    HashRouter,
  } = window.ReactRouterDOM

  function com() {
    function App() {
      const {
        useHistory,
        useLocation,
        HashRouter,
        Route,
        Switch,
        Redirect,
      } = window.ReactRouterDOM
      const history = useHistory()


      const initState = (() => {
        try {
          return JSON.parse(window.localStorage.getItem(`HttpShowState`) || undefined)
        } catch (error) {
          console.log(error)
          // return {}
        }
        return { // 默认值
          swagger: false, // 是否显示 swagger 文档
          activeTabs: `ReqRes`,
        }
      })();

      const [state, setState] = useState({ // 默认值
        ...initState,
        apiList: [],
        replayDone: true,
        captureImg: undefined, // 截图 objectUrl
        // fullApi: `GET /api/options/?page=1&pageSize=999`,
        // fullApi: `POST /api/auth/login/`,
        // fullApi: `PUT /api/regulations/2020200019/normal/`, // 500 => html
        // fullApi: `GET /static/static/hot.95598193.png`,
        // fullApi: `POST /api/dynamicdatatemplate/search/?a=1&b=2`,
      });

      function capture () {
        if(state.captureImg) {
          setState(preState => ({...preState, captureImg: undefined}))
        } else {
          const node = document.getElementById(`root`)
          // const scale = 1200 / node.offsetWidth; // 生成固定宽度的图像
          const scale = 1.5;
          const cfg = {
            height: node.offsetHeight * scale,
            width: node.offsetWidth * scale,
            style: {
              transform: "scale(" + scale + ")",
              transformOrigin: "top left",
              width: node.offsetWidth + "px",
              height: node.offsetHeight + "px",
            }
          }
          domtoimage.toBlob(node, cfg).then(async function (blob) {
            const objectUrl = await blobTool(blob, `toObjectURL`)
            setState(preState => ({...preState, captureImg: objectUrl}))
          }).catch(err => {
            console.log(`err`, err)
          })
        }
      }

      function replay() {
        const {method, api} = state.httpData
        const replayDone = state.replayDone
        if(replayDone) {
          setState(preState => ({...preState, replayDone: false}))
          http.get(`/${method},replay${api}`).then(res => {
            setState(preState => ({...preState, replayDone: true}))
            message.info(`重发请求成功 ${res.message}`)
            getHttpData({method, api})
          }).catch(err => {
            message.error(`重发失败 ${err}`)
          })
        } else {
          message.info('请等待重发结束')
        }
      }
      function hideDoc() {
        setState(preState => ({...preState, swagger: false}))
        $(`.swaggerBox`).addClass(`hide`).removeClass(`show`)
        $(`#root`).css({width: ``})
      }
      function showDoc({$swaggerApiDom}) {
        setState(preState => ({...preState, swagger: true}))
        $(`.swaggerBox`).removeClass(`hide`).addClass('show')
        $(`#root`).css({width: `50%`})
        $(`#swagger-ui`).scrollTo($swaggerApiDom.parent())
      }
      function swagger() {
        if($(`.swaggerBox`).hasClass(`show`)) {
          hideDoc()
        } else {
          // 滚动 swagger 视图到相同的 api 位置
          let {method, path} = state.httpData.data.req.lineHeaders.line
          method = method.toLowerCase()
          // 去除非 api 前缀, 仅留下 api 本身 /api/getFile => /getFile
          path = path.replace(/^\/(.+?)(\/.*)/, '$2')
          // method = `get`
          // path = `/headers`
          const selStr = `.opblock-summary-${method} [data-path="${path}"]`
          const $swaggerApiDom = $(selStr)
          if ($swaggerApiDom.length === 0) {
            message.error(`未找到文档`)
            return false
          }
          const $opblock = $swaggerApiDom.parents(`.opblock`) // 获取当前点击的 swagger api, 并且不是展开状态的元素
          if ($opblock.hasClass(`open`) === false) {
            $swaggerApiDom.click() // 打开
          }
          $opblock.addClass(`open`)

          // 一些 dom 改变事件, 当用户操作 swagger api, 例如点击 `try it out` 的时候, 重新获取高度, 并同步到 swaggerBox 和 swaggerShadow
          const domChange = `DOMAttrModified DOMAttributeNameChanged DOMCharacterDataModified DOMElementNameChanged DOMNodeInserted DOMNodeInsertedIntoDocument DOMNodeRemoved DOMNodeRemovedFromDocument DOMSubtreeModified`
          $('.opblock').off(domChange) // 监听前先取消所有类似元素的监听, 避免多于的监听造成卡顿
          function changeFn() {
            const pos = getAbsolutePosition($opblock[0])
            if (pos.height === 0) {
              return false; // 高度为 0 则不进行处理
            } else {
              let newHeight = `${pos.height}px`
              $(`#swagger-ui`).css({
                height: newHeight,
              })
            }
          }
          setTimeout(changeFn, 500) // 如果没有 dom 改变, 那也执行, 在 500 毫秒(等待样式展示)之后
          $opblock.on(domChange, debounce(changeFn, 100))

          console.log(`selStr`, selStr)
          showDoc({$swaggerApiDom})
        }
      }

      function tabsChange(key) {
        console.log(key);
        setState(preState => ({...deepSet(preState, `activeTabs`, key)}))
      }

      const location = useLocation();


      function getSimpleInfo(httpData) {
        if(!httpData.data) {
          return {}
        }
        const res = httpData.data.res
        const {method, api} = httpData
        let simpleInfo = {
          method,
          api,
          // fullApi,
          statusCode: res.lineHeaders.line.statusCode,
          contentType: res.lineHeaders.headers[`content-type`],
          extensionName: (res.bodyPath || '').replace(/(.*)(\.)/, ''),
          date: res.lineHeaders.headers.date,
        }
        return simpleInfo
      }

      function getHttpData({method, api}) {
        console.log(`method, api`, method, api)
        const fullApi = `${method.toLocaleUpperCase()} ${api}`
        console.log(`fullApi`, fullApi)
        http.get(`${method},getHttpData${api}`).then(res => {
          const newData = {
            method,
            api,
            data: res,
          }
          setState(preState => ({
            ...preState,
            fullApi,
            httpData: newData,
            simpleInfo: getSimpleInfo(newData),
          }))
        })
      }

      function getApiList() {
        const source = new EventSource('/GET,getApiListSse/')
        source.onopen = event => {console.log(`sse onopen`) }
        source.onerror = event => { console.log(`sse onerror`) }
        source.addEventListener('message', event => {
          const newData = JSON.parse(event.data).slice(0, 100)
          // const newData = JSON.parse(event.data)
          setState(preState => ({...deepSet(preState, `apiList`, newData)}))
        }, false);
      }

      useEffect(() => {
        window.localStorage.setItem(`HttpShowState`, JSON.stringify({activeTabs: state.activeTabs}, null, 2))
      }, [state.activeTabs]);

      useEffect(() => {
        getApiList()
      }, []);

      useEffect(() => {
        hideDoc()
        console.log(`location`, location)
        console.log(`location.pathname`, location.pathname)
        // const [, method, api] = window.location.hash.match(/#\/(\w+)(.*)/) || []
        const [, method, api] = (`#${location.pathname}${location.search}`).match(/#\/(\w+)(.*)/) || []
        setState(preState => ({ // 当路由改变时, 清理上一次路由中的数据
          ...preState,
          httpData: {},
          captureImg: undefined,
        }))
        if(method && api) { // 如果 true 显示某个 api 信息; 否则显示所有 api 列表
          getHttpData({method, api})
        }

        const hotKey = new HotKey();
        hotKey.add(`CTRL+C`, ev => {
          if(!getSelectionText()) { // 如果没有选择任何文本
            console.log(`ctrl+c`)
          }
        });
        hotKey.setup({
          metaToCtrl: true,
        });
        hotKey.start();
        return () => hotKey.stop();
      }, [location]);

      const tabList = {
        ReqRes,
        // Doc: () => `Doc`,
      }
      return (
        <Switch>
          <Route cache exact path="/">
            <ApiList apiList={state.apiList} />
          </Route>
          <Route cache path="/*">
            <>
              <div className="info">
                <div className="item api">
                  <span className="key">api:</span>
                  <span className="val">{state.fullApi}</span>
                </div>
                <div className="item status">
                  <span className="key">status:</span>
                  <span className="val">{deepGet(state, `httpData.data.res.lineHeaders.line.statusCode`)} {deepGet(state, `httpData.data.res.lineHeaders.line.statusMessage`)}</span>
                </div>
              </div>
              <div className="options">
                <Button onClick={() => history.push(`/`)} size="small" className="replay">apiList</Button>
                <Button onClick={replay} size="small" className="replay">replay</Button>
                <Button onClick={capture} size="small" type={state.captureImg ? `primary` : `default`} className="capture">capture</Button>
                <Button onClick={swagger} size="small" type={state.swagger ? `primary` : `default`} className="swagger">swagger</Button>
                <div className={`optionsPreViewRes ${state.captureImg && `show`}`}>
                  {state.captureImg && <img className="captureImg" src={state.captureImg} alt="captureImg"/>}
                </div>
              </div>
              <Tabs animated={false} defaultActiveKey={state.activeTabs} onChange={tabsChange}>
                {
                  Object.keys(tabList).map(key => (
                    <TabPane tab={key} key={key}>
                      {
                        state.httpData ?
                          (() => {
                            const ComName = tabList[key]
                            return <ComName httpData={state.httpData} />
                          })()
                        : `(暂无)`
                      }
                    </TabPane>
                  ))
                }
              </Tabs>
            </>
          </Route>
        </Switch>
      )
    }

    return (
      <div className="HttpShow">
        <HashRouter>
          <BackTop visibilityHeight={0} target={() => document.querySelector(`#root`)}/>
          <App />
        </HashRouter>
      </div>
    )
  }

  return com
})()
