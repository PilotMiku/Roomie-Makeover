import type { GameState } from '../domain/model';

export const IDENTITIES: Record<
  GameState['player']['identity'],
  {
    name: string;
    icon: string;
    description: string;
    room: boolean;
    residents: boolean;
    roleplay: boolean;
  }
> = {
  leader: {
    name: '寝室长',
    icon: '♔',
    description: '布置寝室、安排室友，发动大扫除改善宜居度。',
    room: true,
    residents: true,
    roleplay: true,
  },
  observer: {
    name: '旁观者',
    icon: '✧',
    description: '观察日常，也能分享观察与鼓励；时间自动流逝。',
    room: false,
    residents: false,
    roleplay: true,
  },
  member: {
    name: '室友成员',
    icon: '♡',
    description: '与大家平等相处，可编辑室友与安排床位。',
    room: false,
    residents: true,
    roleplay: true,
  },
  parent: {
    name: '家长',
    icon: '❀',
    description: '预约通话或探望，参与校园日常，不占床位。',
    room: false,
    residents: false,
    roleplay: false,
  },
  warden: {
    name: '宿管 / 寝室阿姨',
    icon: '⌂',
    description: '预约查寝、关照公共设施与寝室布置。',
    room: true,
    residents: false,
    roleplay: false,
  },
  manager: {
    name: '楼管',
    icon: '▦',
    description: '预约设施查寝，以平等、尊重的方式提供帮助。',
    room: true,
    residents: false,
    roleplay: false,
  },
  counselor: {
    name: '辅导员',
    icon: '✿',
    description: '预约查寝并交流学习与生活近况。',
    room: false,
    residents: false,
    roleplay: false,
  },
  neighbor: {
    name: '隔壁寝室成员',
    icon: '☆',
    description: '来串门的朋友，可参与室友日常与床位安排。',
    room: false,
    residents: true,
    roleplay: true,
  },
  custom: {
    name: '自定义',
    icon: '🎀',
    description: '给自己的视角起个名字，默认可管理寝室与室友。',
    room: true,
    residents: true,
    roleplay: true,
  },
};
