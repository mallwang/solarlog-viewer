// Extracted from min070328.js (2007-03-28) â€” a stray FTP push apparently
// appended the then-current base_vars.js after the day's minute records
// (see also the embedded "HTTP/1.0 200 Document follows" header noise at
// lines 45-46 of that file, from the same botched transfer).
//
// This documents the Epoch 2 plant configuration in force on that date,
// confirming WRInfo[] itself was NOT swapped back then: WRInfo[0] = SB 2100 TL,
// WRInfo[1] = SB 4200 TL â€” matching the contemporaneous min-file block order
// (see docs/data-format-daily.md). The swap to WRInfo[0] = SB 4200 TL happened
// later, at the Epoch 3 cutover (2013-01-04).
//
// Kept for reference only; not loaded by visu.html.
var Boot=99
var AnlagenKWP=6200
var time_start = new Array(8,7,6,6,5,5,5,6,7,7,7,8)
var time_end = new Array(17,18,20,20,21,22,22,21,20,19,17,17)
var sollMonth = new Array(2,6,9,11,12,13,13,12,10,7,3,2)
var SollYearKWP=900
var AnzahlWR = 2
var MaxWRP=new Array(AnzahlWR)
MaxWRP[0]=new Array(2100,13000,333000,2100000)
MaxWRP[1]=new Array(4200,26000,666000,4200000)
var WRInfo = new Array(AnzahlWR)
WRInfo[0]=new Array("WR21TL06","2000132324",2100,0,"SB 2100 TL",1,null,null,2100,null)
WRInfo[1]=new Array("WR42MS05","1100082120",4100,0,"SB 4200 TL",2,null,null,4200,null)
WRInfo[1][6]=new Array("String oben","String rechts")
WRInfo[1][7]=new Array(1,1)
WRInfo[1][9]=new Array(2050,2050)
var HPTitel="Photovoltaik  Allwang"
var HPBetreiber="Familie Allwang"
var HPEmail="fam.allwang@t-online.de"
var HPStandort="92266 Ensdorf"
var HPModul="20 Sanyo HIP 205 / 10 Sanyo HIP 210"
var HPWR="SMA SB 4200 TL  / SB 2100TL"
var HPLeistung="6,2 KWp"
var HPInbetrieb="15.03.2006"
var HPAusricht="SSW 195°, 45 Grad Dachneigung"
var BannerZeile1="Familie Allwang "
var BannerZeile2="6,2 KWp in 92266 Ensdorf"
var BannerZeile3="am Netz seit März 2006"
var BannerLink="www.allwang.homepage.t-online.de/solarlog/index.html"
var StatusCodes = new Array(2)
var FehlerCodes = new Array(2)
StatusCodes[0] = "Offset,Stop,Netzueb.,Warten,U-Konst,I-Konst,Mpp-Such,Mpp,Stoer.,Fehler,Mpp Peak,Derating,Zuschalt.,Uac / Rel,Stop 1,Calib,"
FehlerCodes[0] = "-------,NUW-UAC,NUW-FAC,NUW-ZAC,K1-Trenn,K2-Trenn,EEPROM dBh,ROM,NUW-dI,B1,B2,B3,B4,EeRestore,B6,B7,B8,Iac-DC_Offs-Bfr,OFFSET,EEPROM,Bfr-Srr,K1-Schliess,Watchdog,Uzwk,UpvMax,Riso,dI-Mess,dI,Uac-Bfr,Fac-Bfr,Zac-Bfr,dZac-Bfr,S1,S2,S3,S4,S5,S6,S7,S8,S9,S10,S11,S12,S13,S14,S15,S16,S17,S18,S19,S20,S21,S22,S23,Iac-DC_Offs-Srr,Imax,Shut-Down,dI-Srr,Uac-Srr,Fac-Srr,Zac-Srr,dZac-Srr,NUW-Timeout,"
StatusCodes[1] = "Offset,Stop,Netzueb.,Warten,Der. T. WR,Der. T. DC,Riso,Mpp,Stoer.,Fehler,U-Konst,Derating,R12,I-Konst,Mpp Peak,Der. Idc,"
FehlerCodes[1] = "-------,NUW-UAC,NUW-FAC,NUW-ZAC,NUW-dI,DC-BFS,EEPROM dBh,ROM,RAM,DC-A def.,DC-B def.,BFR11,DCBFS Version,OFFSET,Uac-Bfr,Fac-Bfr,dFac-Bfr,Zac-Bfr,dZac-Bfr,EeRestore,CAN,Varistor,Kom DC-BFS,Riso,EEPROM,Uzwk,dI-Bfr,dI-Mess,Watchdog,Imax DC,MWE Defekt DC,DCBFS-Startup,Rechner,Uac-Srr,Fac-Srr,Zac-Srr,dZac-Srr,Imax,SRR7,dI-Srr,Relais1,Relais2,Relais3,Relais4,SRR13,L-Netz,N-WR,N-Netz,L<->N,NUW-Timeout,HW-Signal,SRR20,SRR21,SRR22,SRR23,Shutdown,UDiff,IGBTs,SRR27,Uzkposneg<10,dI-Test,SRR30,Watchdog Srr,SRR32,"
var Verguetung=5180
var Serialnr =   16226561
var Firmware = "1.3.0 Build 26e"
var FirmwareDate = "08.03.2007"
var WRTyp = "SMA"
var SLTyp = "400"
var SLVer = 1
var Lizenz = 0
var Intervall = 300
var SLDatum = "30.03.07"
var SLUhrzeit = "20:10:02"
var DCFInfo = new Array(1,36,48,42,1,1,1,2,1,1)
