! ============================================================================
!   StaticBin · Fortran demo
!   Reproduces the SPEC §8 golden vectors.
!   Expected outputs (must match the other ports bit-for-bit):
!       empty     ->  A
!       text_hi   ->  BEhcQ0NI
!       bitfield  ->  Gptg
!       ints      ->  DmEaZCg
!       dynamic   ->  D8FNo4g
!       compound  ->  A1IE8QpujC6NLGhNLcl6
! ============================================================================

program demo
  use, intrinsic :: iso_fortran_env, only: int64
  use staticbin
  implicit none

  character(len=:), allocatable :: empty_stream
  character(len=:), allocatable :: hi_stream
  character(len=:), allocatable :: flags_stream
  character(len=:), allocatable :: ints_stream
  character(len=:), allocatable :: dynamic_stream
  character(len=:), allocatable :: compound_stream

  character(len=:), allocatable :: sec(:)
  character(len=:), allocatable :: dyn_chunks(:)
  logical :: bits(5)
  logical :: compound_flags(4)
  integer(int64) :: vals(5)

  ! ---- empty ----
  allocate(character(len=1) :: sec(0))
  empty_stream = to_base64url(stream_of(sec, 0))
  print "(a,a)", "empty     ->  ", empty_stream
  deallocate(sec)

  ! ---- text "hi" ----
  block
    character(len=:), allocatable :: local(:)
    allocate(character(len=128) :: local(1))
    local(1) = encode_text("hi")
    hi_stream = to_base64url(stream_of(local, 1))
  end block
  print "(a,a)", "text_hi   ->  ", hi_stream

  ! ---- bitfield [1,0,1,1,0] ----
  bits = [.true., .false., .true., .true., .false.]
  block
    character(len=:), allocatable :: local(:)
    allocate(character(len=128) :: local(1))
    local(1) = encode_bitfield(bits, 5)
    flags_stream = to_base64url(stream_of(local, 1))
  end block
  print "(a,a)", "bitfield  ->  ", flags_stream

  ! ---- integers [1,2,3,4,5] ----
  vals = [1_int64, 2_int64, 3_int64, 4_int64, 5_int64]
  block
    character(len=:), allocatable :: local(:)
    allocate(character(len=128) :: local(1))
    local(1) = encode_integers(vals, 5)
    ints_stream = to_base64url(stream_of(local, 1))
  end block
  print "(a,a)", "ints      ->  ", ints_stream

  ! ---- dynamic ["1","010","0001000"] ----
  allocate(character(len=7) :: dyn_chunks(3))
  dyn_chunks(1) = "1      "
  dyn_chunks(2) = "010    "
  dyn_chunks(3) = "0001000"
  block
    character(len=:), allocatable :: local(:)
    allocate(character(len=128) :: local(1))
    local(1) = encode_dynamic(dyn_chunks, 3)
    dynamic_stream = to_base64url(stream_of(local, 1))
  end block
  print "(a,a)", "dynamic   ->  ", dynamic_stream

  ! ---- compound: text "StaticBin" + bitfield [1,1,0,1] ----
  compound_flags = [.true., .true., .false., .true.]
  block
    character(len=:), allocatable :: local(:)
    allocate(character(len=256) :: local(2))
    local(1) = encode_text("StaticBin")
    local(2) = encode_bitfield(compound_flags, 4)
    compound_stream = to_base64url(stream_of(local, 2))
  end block
  print "(a,a)", "compound  ->  ", compound_stream

end program demo
