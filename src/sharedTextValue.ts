/*******************************************************************************
*                                                                              *
*                               shared TextValue                               *
*                                                                              *
*******************************************************************************/

  import { quoted } from 'javascript-interface-library'

  let automerge:any, isValidAutomergeUrl:any, Repo:any      // will be set later
  let IndexedDBStorageAdapter:any                                        // dto.
  let BrowserWebSocketClientAdapter:any, BroadcastChannelNetworkAdapter:any

  import { render, html, Component } from 'htm/preact'

/**** install stylesheet for SSK ****/

  const Stylesheet = document.createElement('style')
    Stylesheet.setAttribute('id','sharedTextValue')
    Stylesheet.innerHTML = `/*******************************************************************************
*                                                                              *
*                               shared TextValue                               *
*                                                                              *
*******************************************************************************/

  html {
    width:100%; height:100%; overflow:hidden;

    font-family:'Source Sans Pro','Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:14px; font-weight:normal; line-height:1.4; color:black;

    background-color: white;
    background-image: url(/common/BinaryTexture_white.jpg);
    background-repeat:repeat;

    -webkit-box-sizing:border-box; -moz-box-sizing:border-box; box-sizing:border-box;
  }
  body {
    width:100%; height:100%; overflow:hidden;
    margin:0px; padding:0px;
  }

  :disabled, .disabled {
    opacity:80%; pointer-events:none;
  }

/**** ApplicationView ****/

  .ApplicationView {
    display:flex; position:relative;
      flex-flow:column nowrap; align-items:stretch;
    width:480px; height:640px; min-width:480px; min-height:640px;
    margin:20px auto auto auto;
    border:solid 1px lightgray; border-radius:8px;
    box-shadow:0px 0px 20px 0px rgba(0,0,0,0.8);
    background:white;
    padding:10px;

    font-family:'Source Sans Pro','Helvetica Neue',Helvetica,Arial,sans-serif;
    font-size:14px; font-weight:normal; line-height:1.4; color:black;

    -webkit-box-sizing:border-box; -moz-box-sizing:border-box; box-sizing:border-box;
  }

  .Title {
    display:block; position:relative;
    font-size:18px; font-weight:bold;
  }

  .Separator {
    display:block; position:relative;
    width:100%; height:1px;
    margin:4px 0px 4px 0px;
    border:none; border-top:solid 1px gray;
  }

  p {
    display:block; position:relative;
    margin:6px 0px 6px 0px;
    text-align:justify;
  }

  .ButtonFace {
    display:inline-block; position:relative;
    margin:0px 2px 0px 2px; padding:0px 4px 0px 4px;
    border:solid 1px lightgray; border-radius:4px;
    background:linear-gradient(180deg, #FFFFFF 0%, #EEEEEE 100%)
  }

/**** PaneSwitcher ****/

  .PaneSwitcher {
    display:block; position:relative; flex:1 1 auto;
  }

/**** CenteringPane ****/

  .CenteringPane {
    display:block; position:relative;
    width:100%; height:100%; max-height:240px;
  }

  .CenteringPane > * {
    display:block; position:absolute;
    left:50%; top:50%;
    transform:translate(-55%,-50%);
    white-space:nowrap;
  }

/**** SessionPane ****/

  .SessionPane {
    display:flex; position:relative;
      flex-flow:column nowrap; align-items:stretch;
    width:100%; height:100%;
  }

/**** MessageView ****/

  .MessageView {
    display:block; position:relative;
    width:100%; height:24px;
    text-align:left; line-height:24px;
  }`
  document.head.appendChild(Stylesheet)

/**** make some existing types indexable ****/

  interface Indexable { [Key:string]:any }

/**** Settings and Variables ****/

  const DefaultURL = 'automerge:4KJrmBdEJdkfesNUnWzZEMeKkBEK'

  let sharedText:string
  let MainView:ApplicationView
  let Message:string = ''

//------------------------------------------------------------------------------
//--                             Session Handling                             --
//------------------------------------------------------------------------------

  const SessionStates = [
    'unprepared','prepared','opening','open','closed','broken'
  ]
  let SessionState:typeof SessionStates[number] = 'unprepared'

  let sharedRepo:any|undefined
  let sharedURL:string|undefined
  let sharedDocHandle:any|undefined

  function sharedDoc ():Indexable {
    return sharedDocHandle.docSync()
  }

/**** prepareSession ****/

  function prepareSession (DefaultURL:string):void {
    sharedRepo = new Repo({
      network: [
        new BroadcastChannelNetworkAdapter(),
        new BrowserWebSocketClientAdapter('wss://sync.automerge.org')
      ],
      storage: new IndexedDBStorageAdapter(),
    })
    SessionState = 'prepared'

    sharedURL = DefaultURL
  }

/**** createSession ****/

  function createSession ():void {
    sharedDocHandle = sharedRepo.create()
    sharedURL       = sharedDocHandle.url

    runSession()
  }

/**** openSession ****/

  function openSession (SessionURL:string):void {
    if (! isValidAutomergeUrl(SessionURL)) throw new Error(
      'InvalidArgument: invalid Automerge URL given'
    )

    SessionState    = 'opening'
    sharedDocHandle = sharedRepo.find(sharedURL = SessionURL)

    const thisHandle = sharedDocHandle
    setTimeout(() => {
      if (
        (sharedDocHandle !== thisHandle) ||       // original handle is obsolete
        (sharedDocHandle.state === 'ready')  // doc has been opened successfully
      ) { return }

      abortSession()

      handleSessionTimeout(sharedDocHandle.state)
    },10000)

    sharedDocHandle.whenReady().then(() => {
      if (sharedDocHandle === thisHandle) { runSession() }
    })
  }

/**** runSession ****/

  function runSession ():void {
    SessionState = 'open'

    sharedDocHandle.on('change',internalize)

    reportChangeLogLength()
    MainView.rerender()
  }

/**** closeSession ****/

  function closeSession ():void {
    sharedDocHandle = undefined
    sharedURL       = DefaultURL

    SessionState = 'closed'
  }

/**** abortSession ****/

  function abortSession ():void {
    sharedDocHandle = undefined
    sharedURL       = DefaultURL

    SessionState = 'broken'
  }

/**** handleSessionTimeout ****/

  function handleSessionTimeout (HandleState:string):void {
    switch (HandleState) {
      case 'deleted':
        window.alert('The requested document has been deleted')
        break
      case 'unavailable':
        window.alert('The requested document is not available')
        break
      default:
        window.alert('The requested document took too long to open')
    }
    MainView.rerender()
  }

//------------------------------------------------------------------------------
//--                            Change Processing                             --
//------------------------------------------------------------------------------

/**** externalize ****/

  function externalize (Callback:Function):void {
    if (SessionState != 'open') { return }

    sharedDocHandle.change(Callback)

    reportChangeLogLength()
    MainView.rerender()
  }

/**** internalize ****/

  function internalize (Event:any):void {
    if (SessionState != 'open') { return }

    if (typeof Event.doc.Text === 'string') {
      sharedText = Event.doc.Text
      reportChangeLogLength()
    } else {
      window.alert('Invalid External Change\n\nThe external data has an invalid type')
      abortSession()
    }

    MainView.rerender()
  }

/**** reportChangeLogLength ****/

  function reportChangeLogLength ():void {
    const ChangeLogLength = automerge.save(sharedDoc()).length
    Message = 'current change log length: ' + ChangeLogLength + ' bytes'
//  MainView.rerender()
  }

/**** ApplicationView ****/

  class ApplicationView extends Component {
    public state:number = 0

    public componentDidMount ():void {
      MainView = this
    }

    public rerender ():void {
      (this as Component).setState(this.state + 1)
    }

  /**** render ****/

    public render (PropSet:Indexable):any {
      return html`<div class="ApplicationView">
        <div class="Title">Shared TextValue</div>
        <div class="Separator"/>

        <p>
          This little programming experiment shares a given text
          using <a href="https://automerge.org/">Automerge</a>.
        </p>

        <p>
          It has been written during the "Automerge Build Day/1" and
          demonstrates basic session handling and last-write-wins
          sharing of a single JavaScript string.
        </p>

        <p>
          The source code is available
          on <a href="https://github.com/rozek/sharedTextValue">GitHub</a>.
        </p>

        <p>
          <b>Nota bene: this is not a shared text editor</b> - later text
          changes deliberately replace former ones completely. Instead,
          concurrent changes are detected and the user warned in such a
          situation.
        </p>

        <div class="Separator"/>
          <${PaneSwitcher}/>
        <div class="Separator"/>
        <${MessageView}/>
      </div>`
    }
  }

/**** PaneSwitcher ****/

  class PaneSwitcher extends Component {
    public render (PropSet:Indexable):any {
      return html`<div class="PaneSwitcher">
        <${this.relevantPane}/>
      </div>`
    }

    public relevantPane ():any {
      switch (SessionState) {
        case 'unprepared': return html`<${SplashPane}/>`
        case 'prepared':   return html`<${SessionSelectionPane}/>`
        case 'opening':    return html`<${SessionOpeningPane}/>`
        case 'open':       return html`<${SessionPane}/>`
        case 'closed':
        case 'broken':     return html`<${SessionSelectionPane}/>`
      }
    }
  }

/**** CenteringPane ****/

  class CenteringPane extends Component {
    public render (PropSet:Indexable):any {
      return html`<div class="CenteringPane">
        ${PropSet.children}
      </div>`
    }
  }

/**** SplashPane ****/

  class SplashPane extends Component {
    public render (PropSet:Indexable):any {
      return html`<${CenteringPane}>
        <span>Automerge is loading, please wait...</span>
      </>`
    }
  }

/**** SessionSelectionPane ****/

  class SessionSelectionPane extends Component {
    public URL:string = sharedURL || ''

    public state:number = 0

    public rerender ():void {
      (this as Component).setState(this.state + 1)
    }

    public render (PropSet:Indexable):any {
      let URLisValid:boolean = false
      let URLMessage:string  = ''

      switch (true) {
        case (this.URL.trim() === ''):
          URLMessage = '(no URL given)'
          break
        case (
          ! isValidAutomergeUrl(this.URL) &&
          ! isValidAutomergeUrl('automerge:' + this.URL)
        ):
          URLMessage = '(invalid URL given)'
          break
        default:
          URLisValid = true
      }

      if (URLisValid) {
        sharedURL = (
          this.URL.startsWith('automerge:') ? this.URL : 'automerge:' + this.URL
        )
      } else {
        sharedURL = ''
      }

      function onNew ():void {
        createSession()
        MainView.rerender()
      }

      function onOpen ():void {
        openSession(sharedURL as string)
        MainView.rerender()
      }

      return html`<div class="SessionSelectionPane">
        <p>
          Press <div class="ButtonFace">New</> to create a new shared
          document or enter a valid Automerge URL and press
          <div class="ButtonFace">Open</> to open an existing one.
        </p>

        <table style="width:100%; height:100%">
          <tr>
            <td>URL:</td>
            <td>
              <input type="text" style="margin:0px 4px 0px 4px; width:320px"
                placeholder="enter URL here"
                value=${this.URL}
                onInput=${(Event) => { this.URL = Event.target.value; this.rerender() }}
              />
            </td><td>
              <button style="width:80px" disabled=${! URLisValid}
                onClick=${onOpen}>Open</button>
            </td>
          </tr><tr>
            <td></td>
            <td>
              <span style="color:red; margin-left:6px">${URLMessage}</span>
            </td><td>
              <button style="width:80px" onClick=${onNew}>New</button>
            </td>
          </tr>
        </table>
      </div>`
    }
  }

/**** SessionOpeningPane ****/

  class SessionOpeningPane extends Component {
    public render (PropSet:Indexable):any {
      return html`<${CenteringPane}>
        <div style="display:inline-block; position:relative">
          Loading document
            <div style="height:8px"/>
          <div style="padding-left:6px">${quoted(sharedURL)}</>
            <div style="height:8px"/>
          please wait...
        </div>
      </>`
    }
  }

/**** SessionPane ****/

  class SessionPane extends Component {
    public TextToShow:string = sharedDoc().Text || ''

    public render (PropSet:Indexable):any {
      const my         = (this as Component)
      const myElement  = my.base
      const sharedText = sharedDoc().Text || ''

      const isFocused = (
        (myElement != null) && (document.activeElement != null) &&
        (document.activeElement.tagName === 'TEXTAREA') &&
        myElement.contains(document.activeElement)
      )
      if (! isFocused) { my.TextToShow = sharedText }

      const externallyChanged = (
        my.TextToShow !== sharedText
      )

      function onInput (Event):void {
        const TextToShare = Event.target.value
        externalize((Doc) => Doc.Text = my.TextToShow = TextToShare)
      }

      function onBlur (Event):void {
        if (externallyChanged) {
          my.TextToShow = sharedText
          MainView.rerender()
        }
      }

      function onClose ():void {
        closeSession()
        MainView.rerender()
      }

      return html`<div class="SessionPane">
        <div style="margin:4px 0px 6px 0px">
          URL:
          <input type="text" readonly style="margin:0px 4px 0px 4px; width:320px"
            value=${sharedURL}
          />
          <button style="width:80px" onClick=${onClose}>Close</button>
        </div>

        <textarea style="width:100%; height:100%; flex:1 1 auto; resize:none"
          value=${my.TextToShow} placeholder="(enter your text here)"
          onInput=${onInput} onBlur=${onBlur}
        ></textarea>

        <p>
          Your input will be immediately shared, but external changes only
          shown while the text editor does not own the keyboard focus.
        </p>

        <div style="display:block; height:30px">${
          externallyChanged
          ? html`
              <span style="color:red">Note: there are external changes pending</span>
              <button style="width:80px; margin-left:10px">Refresh</button>
            `
          : ''
        }</div>
      </div>`
    }
  }

/**** MessageView ****/

  class MessageView extends Component {
    public render (PropSet:Indexable):any {
      return html`<div class="MessageView">
        ${Message}
      </div>`
    }
  }

/**** startApplication ****/

  function startApplication () {
    ({
      next:automerge, isValidAutomergeUrl, Repo,
      IndexedDBStorageAdapter,
      BrowserWebSocketClientAdapter, BroadcastChannelNetworkAdapter
// @ts-ignore TS2339 allow "window.automerge"
    } = window.automerge)

    prepareSession(DefaultURL)
    MainView.rerender()
  }

  render(html`<${ApplicationView}/>`,document.body)

/**** "automerge" must be available before application may be started ****/

// @ts-ignore TS2339 allow "window.automerge"
  if (window.automerge == null) {
    document.addEventListener('automerge',startApplication)
  } else {
    startApplication()
  }

