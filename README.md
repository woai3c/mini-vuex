# mini-vuex
和mini-vue配套使用的状态管理模式


### 支持以下选项
* state
* getters
* mutations
* actions
* plugins

不支持模块

### 使用方法
```
<script src="mini-vue.js"></script>
<script src="mini-vuex.js"></script>
```
示例
```
<div id="app"></div>

const store = new MiniVuex.Store({
  state: {
    count: 1
  }
})

const vm = new MiniVue({
  el: '#app',
  store,
})
```
