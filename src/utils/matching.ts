export function calculateMatchScore(me: any, target: any): number {
  if (!me || !target) return 0;

  // 1. Hard Filters
  // Gender & Orientation
  const isCompatibleOrientation = (personA: any, personB: any) => {
    if (personA.orientation === '异性恋') {
      if (personA.gender === '男' && personB.gender !== '女') return false;
      if (personA.gender === '女' && personB.gender !== '男') return false;
    } else if (personA.orientation === '同性恋') {
      if (personA.gender !== personB.gender) return false;
    }
    return true;
  };

  if (!isCompatibleOrientation(me, target) || !isCompatibleOrientation(target, me)) {
    return 0;
  }

  // Height
  if (me.heightRange && target.height) {
    if (target.height < me.heightRange.min || target.height > me.heightRange.max) return 0;
  }
  if (target.heightRange && me.height) {
    if (me.height < target.heightRange.min || me.height > target.heightRange.max) return 0;
  }

  // Campus
  if (me.crossCampus === '不接受' && me.campus !== target.campus) return 0;
  if (target.crossCampus === '不接受' && me.campus !== target.campus) return 0;

  // College
  if (me.sameCollege === '不接受' && me.college === target.college) return 0;
  if (target.sameCollege === '不接受' && me.college === target.college) return 0;

  // 2. Soft Scoring
  let score = 80; // Base score
  let maxPossibleScore = 80;

  const importantQuestionsMe = me.importantQuestions || [];
  const importantQuestionsTarget = target.importantQuestions || [];

  // Helper to calculate deduction for single sliders (similarity)
  const scoreSingleSlider = (key: string, weight = 2) => {
    if (me[key] !== undefined && target[key] !== undefined) {
      const diff = Math.abs(me[key] - target[key]);
      let deduction = (diff / 6) * weight;
      if (importantQuestionsMe.includes(key)) deduction *= 1.5;
      if (importantQuestionsTarget.includes(key)) deduction *= 1.5;
      score -= deduction;
    }
  };

  // Helper to calculate deduction for complementary sliders
  const scoreComplementarySlider = (key: string, weight = 2) => {
    if (me[key] !== undefined && target[key] !== undefined) {
      // Ideal sum is 8 (e.g., 1 and 7, 4 and 4)
      const diff = Math.abs((me[key] + target[key]) - 8);
      let deduction = (diff / 6) * weight;
      if (importantQuestionsMe.includes(key)) deduction *= 1.5;
      if (importantQuestionsTarget.includes(key)) deduction *= 1.5;
      score -= deduction;
    }
  };

  // Helper to calculate deduction for double sliders
  const scoreDoubleSlider = (key: string, weight = 3) => {
    if (me[key] && target[key]) {
      const diff1 = Math.abs(me[key].partner - target[key].self);
      const diff2 = Math.abs(target[key].partner - me[key].self);
      
      let deduction1 = (diff1 / 6) * (weight / 2);
      if (importantQuestionsMe.includes(key)) deduction1 *= 1.5;
      
      let deduction2 = (diff2 / 6) * (weight / 2);
      if (importantQuestionsTarget.includes(key)) deduction2 *= 1.5;
      
      score -= (deduction1 + deduction2);
    }
  };

  // Apply scoring
  const singleSliders = [
    'lifePath', 'marriageView', 'kindnessVsSmart', 'idealVsMaterial', 'moneyAttitude',
    'familyVsCareer', 'processVsResult', 'tryNewThings', 'conflictResponse',
    'sleepSchedule', 'partnerTidiness', 'dietPreference', 'spicyTolerance',
    'weekendDate', 'freeTimeTogether', 'travelStyle', 'spendingStyle',
    'messageAnxiety', 'ritualSense', 'oppositeSexFriend', 'relationshipPace',
    'showAffection', 'criticismResponse', 'dependency', 'similarHobbies',
    'partnerAppearanceEffort', 'appearanceWeight'
  ];
  singleSliders.forEach(key => scoreSingleSlider(key));

  const complementarySliders = ['interactionMode', 'carePreference'];
  complementarySliders.forEach(key => scoreComplementarySlider(key));

  const doubleSliders = ['careerAttitude', 'decisionMaking', 'socialEnergy', 'smoking', 'drinking', 'appearanceType'];
  doubleSliders.forEach(key => scoreDoubleSlider(key));

  // Hobbies Bonus
  if (me.coreHobbies && target.coreHobbies) {
    const sharedHobbies = me.coreHobbies.filter((h: string) => target.coreHobbies.includes(h));
    score += sharedHobbies.length * 2; // +2 for each shared hobby
    maxPossibleScore += Math.min(me.coreHobbies.length, target.coreHobbies.length) * 2;
  }

  // Traits Bonus
  if (me.partnerTraits && target.selfTraits) {
    const matchedTraits1 = me.partnerTraits.filter((t: string) => target.selfTraits.includes(t));
    score += matchedTraits1.length * 1.5;
    maxPossibleScore += me.partnerTraits.length * 1.5;
  }
  if (target.partnerTraits && me.selfTraits) {
    const matchedTraits2 = target.partnerTraits.filter((t: string) => me.selfTraits.includes(t));
    score += matchedTraits2.length * 1.5;
    maxPossibleScore += target.partnerTraits.length * 1.5;
  }

  // Normalize score to 0-100 range
  let finalScore = Math.round((score / maxPossibleScore) * 100);
  
  // Add some randomness so it's not always exactly the same if people have same answers
  // finalScore += Math.floor(Math.random() * 3) - 1; 
  
  if (finalScore > 99) finalScore = 99; // Cap at 99%
  if (finalScore < 0) finalScore = 0;

  return finalScore;
}
