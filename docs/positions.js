// Value both sides at the same observed market price, not the slipped fill.
export function tradePosition(data,t){
 const mark=data.bars[t[0]][t[1]][0];
 const cashBefore=t[6]+t[2]*t[3]*t[4]+t[5];
 const equityBefore=cashBefore+t[12]*mark,equityAfter=t[6]+t[7]*mark;
 return {mark,cashBefore,equityBefore,equityAfter,sharesBefore:t[12],sharesAfter:t[7],
  before:t[12]*mark/equityBefore,after:t[7]*mark/equityAfter};
}
