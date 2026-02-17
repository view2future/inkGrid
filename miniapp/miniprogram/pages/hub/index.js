const { BASE_URL } = require('../../utils/config');

Page({
  data: {
    charTotal: 135,
    steleTotal: 79,
  },

  onLoad() {
    // Best-effort: load counts from remote JSON.
    wx.request({
      url: `${BASE_URL}/data/yishan_characters.json`,
      success: (res) => {
        const list = (res && res.data && res.data.characters) || [];
        if (Array.isArray(list) && list.length) {
          this.setData({ charTotal: Math.min(135, list.length) });
        }
      },
    });

    wx.request({
      url: `${BASE_URL}/data/steles.json`,
      success: (res) => {
        const list = (res && res.data && res.data.steles) || [];
        if (Array.isArray(list) && list.length) {
          this.setData({ steleTotal: list.length });
        }
      },
    });
  },

  openChars() {
    wx.navigateTo({ url: '/pages/char/index?i=0' });
  },

  openSteles() {
    wx.navigateTo({ url: '/pages/steles/index' });
  },

  openPosters() {
    wx.navigateTo({ url: '/pages/posters/index' });
  },

  openStudy() {
    wx.navigateTo({ url: '/pages/study/index' });
  },
});
