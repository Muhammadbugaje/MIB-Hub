# Barks: Bature
**Id:** npc.bature
**Voice:** Male, about twenty; Mass Communication, later presenter of "Riddles After Dark" on Ring Road FM. These lines are only his own: the radio, his course, and lines for when he is not your roommate (a female player meets him as Firdausi's cousin). His real radio voice is warm and good; off air he is the clown.

## Filler
### greet
- `bk_bature_f_greet_01` (excited) "Riddle me this: who's Firdausi's favourite cousin? Me. Hi." · when: player_female
- `bk_bature_f_greet_02` (warm) "Ah, my cousin's roommate! Has she named another lizard?" · when: player_female
### bye
- `bk_bature_f_bye_01` (amused) "Stay tuned. That's radio for 'goodbye'."
### ask
- `bk_bature_f_ask_01` (excited) "Listening tonight? Ring Road FM. Say yes. Lie if needed."
### joke
- `bk_bature_f_joke_01` (amused) "Riddle me this, Ring Road: what's on air, and off light? Us."
### idle
- `bk_bature_f_idle_01` (dry) "Mass Comm. We communicate. Massively."
- `bk_bature_f_idle_02` (amused) "Professor! …Sorry. Wrong person. Hello, person."
- `bk_bature_f_idle_03` (dry) "Tanko gave me a riddle last year. I'm still on it."
- `bk_bature_f_idle_04` (dry) "Jega says I'm the worst striker he knows. He knows two."
### night
- `bk_bature_f_night_01` (warm) "Riddles After Dark, eleven p.m. You're awake anyway."
### compliment
- `bk_bature_f_compliment_01` (shy) "You laughed at my riddle. Nobody does that. Thank you." · when: player_female, friendship>=3
### tease
- `bk_bature_f_tease_01` (amused) "Tell Firdausi she owes me garri. Since first year." · when: player_female
### thanks
- `bk_bature_f_thanks_01` (warm) "Thanks. I'll mention you on air. Anonymously. Loudly."
### follow
- `bk_bature_f_follow_01` (amused) "Walking with you. This is now a live outside broadcast."

## Year 1
### idle
- `bk_bature_y1_idle_01` (scared) "I ironed a shirt for radio. Radio can't see shirts."
- `bk_bature_y1_idle_02` (dry) "Jega's team picked me last. Correctly."
### callback
- `bk_bature_y1_callback_01` (scared) "'Good evening. This is, um, the news.' My debut." · when: m018_done
- `bk_bature_y1_callback_02` (proud) "Kabiru let me read the weather. Dust. Nailed it." · when: m018_done

## Year 2
### idle
- `bk_bature_y2_idle_01` (dry) "Kabiru's voice is warm bread. Mine is toast."
- `bk_bature_y2_idle_02` (proud) "Decoy. That was my role. I decoyed beautifully."
### callback
- `bk_bature_y2_callback_01` (warm) "Riddles After Dark. My show. My voice. My riddles." · when: m036_done
- `bk_bature_y2_callback_02` (excited) "A caller solved my riddle. I had to hang up. Jealous." · when: m036_done

## Year 3
### idle
- `bk_bature_y3_idle_01` (dry) "Strike radio: me, a mic, four listeners. Hi, Mum."
- `bk_bature_y3_idle_02` (neutral) "Ring Road FM is quiet. I talk to the transmitter."
### callback
- `bk_bature_y3_callback_01` (warm) "You pulled me up. Riddle me this: tomorrow. I'll have one." · when: m057_done

## Year 4
### idle
- `bk_bature_y4_idle_01` (shy) "Results are out. I topped two courses. Don't tell my reputation."
- `bk_bature_y4_idle_02` (proud) "My show moved to ten. Prime time. For owls."
- `bk_bature_y4_idle_03` (shy) "Top in Media Law. Shh. Officially, I'm a clown."
### callback
- `bk_bature_y4_callback_01` (amused) "Lucky asked for a radio collab. I gave him a riddle. He left." · when: m076_done

## Year 5
### idle
- `bk_bature_y5_idle_01` (sad) "Last show soon. I'll end with a riddle. No answer."
- `bk_bature_y5_idle_02` (dry) "Final project: a radio documentary. Thirty minutes of me."
### callback
- `bk_bature_y5_callback_01` (amused) "'Forty-one per cent cheaper. Source: Okafor.' Who taught me that?" · when: m110_done

## Post-game
### idle
- `bk_bature_post_idle_01` (proud) "Riddles After Dark, still on air. Still awake. Still you?"

## Events
### ev_cup
- `bk_bature_ev_ev_cup_01` (excited) "Commentary by me! Jega's through on goal… he's tied his boot."
### ev_elections
- `bk_bature_ev_ev_elections_01` (proud) "Election night special on Ring Road FM. Bring snacks."
### ev_convocation
- `bk_bature_ev_ev_convocation_01` (sad) "Live from convocation. I'm crying on air. Don't tune out."
### ev_valentine
- `bk_bature_ev_ev_valentine_01` (shy) "Valentine's request line is open. No riddles. …One riddle." · when: player_female, friendship>=3
### ev_strike
- `bk_bature_ev_ev_strike_01` (dry) "Strike playlist: ten songs, all about waiting."
### ev_exam
- `bk_bature_ev_ev_exam_01` (warm) "Exam week on the Ring Road. Lights low, riddles easy."
