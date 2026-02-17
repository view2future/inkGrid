const { BASE_URL } = require('../../utils/config');

function pad4(n) {
  const s = String(n);
  return s.length >= 4 ? s : ('0000' + s).slice(-4);
}

Page({
  data: {
    loading: true,
    current: 0,
    total: 0,
    chars: [],
  },

  onLoad(options) {
    const start = Number(options && options.i);
    this.setData({ current: Number.isFinite(start) && start >= 0 ? start : 0 });

    wx.request({
      url: `${BASE_URL}/data/yishan_characters.json`,
      success: (res) => {
        const list = (res && res.data && res.data.characters) || [];
        const take = Array.isArray(list) ? list.slice(0, 135) : [];
        const chars = take.map((c, i) => {
          const simplified = String((c && (c.simplified || c.char)) || '').trim();
          return {
            simplified,
            image: `${BASE_URL}/steles/extracted_by_grid/char_${pad4(i + 1)}.png`,
          };
        });
        this.setData({
          chars,
          total: chars.length,
          loading: false,
        });
      },
      fail: () => {
        this.setData({ loading: false });
      },
    });
  },

  onChange(e) {
    const idx = e && e.detail && typeof e.detail.current === 'number' ? e.detail.current : 0;
    this.setData({ current: idx });
  },
});
