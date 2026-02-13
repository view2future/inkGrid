import os
import json
import re

def parse_md_table(content, script_type):
    """解析 Markdown 表格提取碑帖元数据。"""
    steles = []
    # 匹配表格行 | id | name | calligrapher | dynasty | year | type | location |
    pattern = re.compile(r'\| ([\w_]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|')
    matches = pattern.findall(content)
    
    for m in matches:
        stele_id = m[0].strip()
        if stele_id == 'id' or stele_id == '----': continue
        
        steles.append({
            "id": stele_id,
            "name": m[1].strip(),
            "aliases": [m[1].strip()],
            "script_type": script_type,
            "author": m[2].strip(),
            "dynasty": m[3].strip(),
            "year": m[4].strip(),
            "type": m[5].strip(),
            "location": m[6].strip(),
            "total_chars": 0, # 初始设为 0
            "content": "",
            "description": f"{m[3].strip()}{script_type}代表作，由{m[2].strip()}书写。"
        })
    return steles

def build_registry():
    data_dir = "doc/test_data"
    files = {
        "楷书": "楷书名帖测试数据集.md",
        "隶书": "隶书名帖测试数据集.md",
        "篆书": "篆书名帖测试数据集.md"
    }
    
    all_steles = []
    for s_type, f_name in files.items():
        path = os.path.join(data_dir, f_name)
        if os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                all_steles.extend(parse_md_table(content, s_type))

    # 特殊处理：填入已知全文或重要片段
    for s in all_steles:
        # 峄山刻石全文 (222字)
        if s['id'] == "zhuan_003":
            s['total_chars'] = 222
            s['content'] = "皇帝曰金石刻尽始皇帝所为也今袭号而金石刻辞不称始皇帝其于久远也如后嗣为之者不称成功盛德丞相臣斯臣去疾御史大夫臣德昧死言臣请具刻诏书金石刻因明白矣臣昧死请制曰可皇帝立国维初在昔嗣世称王讨伐乱逆威动四极武义直方戎臣奉诏经时不久灭六暴强廿有六年上荐高号孝道显明既献泰成乃降专惠亲巡远方登于绎山群臣从者咸思攸长追念乱世分土建邦以开争理功战日作流血于野自泰古始世无万数陀及五帝莫能禁止乃今皇帝一家天下兵不复起灾害灭除黔首康定利泽长久群臣诵略刻此乐石以著经纪皇帝曰金石刻尽始皇帝所为也今袭号而金石刻辞不称始皇帝其于久远也如后嗣为之者不称成功盛德丞相臣斯臣去疾御史大夫臣德昧死言臣请具刻诏书金石刻因明白矣臣昧死请制曰可"
        
        # 曹全碑开头
        if s['id'] == "li_001":
            s['total_chars'] = 849
            s['content'] = "君讳全字景完敦煌效谷人也其先盖周之胄武王秉乾之机翦伐殷商既定尔勋福禄攸同封弟叔振铎于曹国因氏焉秦汉之际曹氏失官于斯而迁于雍州文郊止右扶风或在安定或在武都或居陇西或家敦煌枝分叶布所在为雄"
            
        # 九成宫开头
        if s['id'] == "kai_001":
            s['total_chars'] = 1108
            s['content'] = "九成宫醴泉铭。秘书监检校侍中巨鹿郡公臣魏徵奉敕撰，率更令兼枢机正道。维贞观六年孟夏之月，皇帝避暑乎九成宫，此则隋之仁寿宫也。"

    # 保存到 processor/data/steles.json
    output_path = "processor/data/steles.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump({"steles": all_steles}, f, ensure_ascii=False, indent=2)
    
    print(f"Successfully built registry with {len(all_steles)} steles.")
    print(f"Output saved to {output_path}")

if __name__ == "__main__":
    build_registry()
