import React from 'react';
import { motion } from 'framer-motion';

interface LogoProps {
  size?: number;
}

const Logo: React.FC<LogoProps> = ({ size = 32 }) => {
  return (
    <motion.div 
      style={{ width: size, height: size }}
      className="relative flex items-center justify-center group select-none"
    >
      {/* 1. 外围数字化引力场：多层呼吸光圈 */}
      <motion.div 
        className="absolute inset-0 bg-amber-500/5 blur-2xl rounded-full"
        animate={{ 
          scale: [0.8, 1.3, 0.8],
          opacity: [0.1, 0.3, 0.1]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      
      {/* 2. 精密网格定位线：体现“阵”的精密 */}
      <div className="absolute inset-0 z-0 pointer-events-none">
         {/* 四角锚点线 */}
         <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500/40"></div>
         <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500/40"></div>
         <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-amber-500/40"></div>
         <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500/40"></div>
         
         {/* 动态十字准心 */}
         <motion.div 
            className="absolute inset-0 flex items-center justify-center"
            animate={{ opacity: [0.2, 0.5, 0.2] }}
            transition={{ duration: 3, repeat: Infinity }}
         >
            <div className="w-px h-full bg-gradient-to-b from-transparent via-amber-500/20 to-transparent"></div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-500/20 to-transparent absolute"></div>
         </motion.div>
      </div>

      {/* 3. 核心：真实的墨迹遗珍 (mo_ink.png) */}
      <div className="relative z-10 w-[75%] h-[75%] flex items-center justify-center">
         <motion.img 
            src="/assets/mo_ink.png"
            className="w-full h-full object-contain mix-blend-screen contrast-[1.2] brightness-[1.1]"
            style={{ 
               filter: 'drop-shadow(0 0 15px rgba(245, 158, 11, 0.4))' 
            }}
            animate={{ 
               opacity: [0.8, 1, 0.8],
               scale: [0.98, 1.02, 0.98]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
         />
         
         {/* 扫描掠影波 */}
         <motion.div 
           className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-500/10 to-transparent h-1/4 z-20 pointer-events-none"
           animate={{ top: ['-100%', '200%'] }}
           transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
         />
      </div>

       {/* 4. 数字化坐标文本（装饰） */}
    </motion.div>
  );
};

export default Logo;
