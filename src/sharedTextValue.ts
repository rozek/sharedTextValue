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

/**** make some existing types indexable ****/

  interface Indexable { [Key:string]:any }

/**** "global" variables ****/

  const DefaultURL = 'automerge:4KJrmBdEJdkfesNUnWzZEMeKkBEK'

  let sharedRepo:any|undefined
  let sharedURL:string|undefined = DefaultURL
  let sharedDocHandle:any|undefined

  let MainView:ApplicationView

/**** ApplicationView ****/

  class ApplicationView extends Component {
    public state:number = 0

    public componentDidMount ():void {
      MainView = this
    }

    public rerender ():void {
      (this as Component).setState(this.state + 1)
    }

    public render (PropSet:Indexable):any {
      return html`
<div style="
  display:flex; flex-flow:column nowrap; align-items:stretch;
  width:480px; height:100%;
">
  <h2 style="padding-bottom:4px; border-bottom:solid 1px gray">Shared TextValue</h2>

  <div>
    This little programming experiment shares a given text
    using <a href="https://automerge.org/">Automerge</a>.
  </div>

  <div><b>Nota bene: this is not a shared text editor!</b></div>

  <${PaneSwitcher}/>

  <div style="border-top:solid 1px gray"></div>
</div>`
    }
  }

/**** PaneSwitcher ****/

  class PaneSwitcher extends Component {
    public render (PropSet:Indexable):any {
      return html`
<div style="flex:1 1 auto">
<${this.relevantPane}/>
</div>`
    }

    public relevantPane ():any {
      switch (true) {
// @ts-ignore TS2339 allow "window.automerge"
        case (window.automerge == null):
          return html`<${SplashPane}/>`
        case (sharedDocHandle == null):
          return html`<${StartPane}/>`
        case (sharedDocHandle.state === 'deleted'):
          window.alert('The requested document has been deleted')
          resetSession()
          break
        case (sharedDocHandle.state === 'unavailable'):
          window.alert('The requested document is not available')
          resetSession()
          break
        case (sharedDocHandle.state !== 'ready'):
          return html`<${LoadPane}/>`
        default:
          return html`<${ApplicationPane}/>`
      }
    }
  }

/**** centered ****/

  class centered extends Component {
    public render (PropSet:Indexable):any {
      return html`
<div style="
  display:inline-block; position:relative;
  width:100%; height:100%;
  max-height:240px;
">
  <div style="
    display:block; position:absolute;
    left:50%; top:50%;
    transform:translate(-50%,-50%);
  ">${PropSet.children}</div>
</div>`
    }
  }

/**** SplashPane ****/

  class SplashPane extends Component {
    public render (PropSet:Indexable):any {
      return html`
<${centered}>
  <span style="white-space:nowrap">Automerge is loading, please wait...</span>
</>`
    }
  }

/**** StartPane ****/

  class StartPane extends Component {
    public state:number = 0
    public URL:string   = sharedURL || ''

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

      return html`
<p>
  Press <b>[New]</b> to create a new shared document or enter a valid
  Automerge URL and press <b>[Open]</b> to open an existing one.
</p>

<table>
 <tr>
  <td>URL:</td>
  <td>
    <input type="text" style="margin:0px 4px 0px 4px; width:320px"
      placeholder="enter URL here"
      value=${this.URL}
      onInput=${(Event) => { this.URL = Event.target.value; this.rerender() }}
    />
  </td><td>
    <button style="width:80px" disabled=${! URLisValid} onClick=${openSession}>Open</button>
  </td>
 </tr><tr>
  <td></td>
  <td>
    <span style="color:red; margin-left:6px">${URLMessage}</span>
  </td><td>
    <button style="width:80px" onClick=${createSession}>New</button>
  </td>
 </tr>
</table>`
    }
  }

/**** LoadPane ****/

  class LoadPane extends Component {
    public render (PropSet:Indexable):any {
      return html`
<${centered}>
  <div style="white-space:nowrap">
    Loading document ${quoted(sharedURL)}
    <br>
    please wait...
  </div>
</>`
    }
  }

/**** ApplicationPane ****/

  class ApplicationPane extends Component {
    public TextToShow = sharedDocHandle.docSync().Text

    public render (PropSet:Indexable):any {
      let thisElement = (this as Component).base
      let TextToShow = (
        (thisElement != null) && (document.activeElement != null) &&
        (document.activeElement.tagName === 'TEXTAREA') &&
        thisElement.contains(document.activeElement)
        ? this.TextToShow
        : sharedDocHandle.docSync().Text || ''
      )
      let externalChangesPending = (
        this.TextToShow !== sharedDocHandle.docSync().Text
      )

      let my = this
      function onInput (Event) {
        const TextToShare = Event.target.value
        sharedDocHandle.change((Doc) => {
          Doc.Text = my.TextToShow = TextToShare
        })
      }

      function onBlur (Event) {
        const sharedText = sharedDocHandle.docSync().Text
        if (sharedText !== TextToShow) {
          my.TextToShow = sharedText
          MainView.rerender()
        }
      }

      return html`
<table style="width:100%; margin-top:14px">
 <tr>
  <td>URL:</td>
  <td>
   <input type="text" readonly
     style="margin-left:4px; width:320px"
     value=${sharedURL}
   />
  </td><td>
    <button style="width:80px" onClick=${resetSession}>Close</button>
  </td>
 </tr><tr>
  <td colspan="3">
   <textarea style="width:100%; min-height:200px"
     value=${TextToShow} placeholder="(enter your text here)"
     onInput=${onInput} onBlur=${onBlur}
   ></textarea>
  </td>
 </tr><tr>
  <td colspan="3">
   <p>
    Your input will be immediately shared, but external changes only shown
    while the text editor does not own the keyboard focus.
   </p>
  </td>
 </tr><tr>
  <td colspan="3">${externalChangesPending ? '(there are external changes pending)' : ''}</td>
 </tr>
</table>`
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

    sharedRepo = new Repo({
      network: [
        new BroadcastChannelNetworkAdapter(),
        new BrowserWebSocketClientAdapter('wss://sync.automerge.org')
      ],
      storage: new IndexedDBStorageAdapter(),
    })

    MainView.rerender()
  }
/**** createSession ****/

  function createSession () {
    sharedDocHandle = sharedRepo.create()
    sharedURL       = sharedDocHandle.url

    sharedDocHandle.on('change',(Event) => {
      MainView.rerender()
    })

    MainView.rerender()
  }

/**** openSession ****/

  function openSession () {
    sharedDocHandle = sharedRepo.find(sharedURL)

    sharedDocHandle.on('change',(Event) => {
      MainView.rerender()
    })

    sharedDocHandle.whenReady().then(() => {
      MainView.rerender()
    })

    MainView.rerender()
  }

/**** resetSession ****/

  function resetSession () {
    sharedDocHandle = undefined
    sharedURL       = undefined
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

