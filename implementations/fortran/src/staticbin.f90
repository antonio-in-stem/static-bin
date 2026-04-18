! ============================================================================
!   StaticBin · Fortran 2008 reference port
! ============================================================================
!   A self-contained module that provides bit-level encode/decode primitives,
!   the three section modes (FIXED / DYNAMIC / INTEGER), and base64url I/O.
!   Bit-strings are carried as ASCII character arrays of '0' and '1' so that
!   the implementation stays literally identical to the Python reference
!   and is trivially auditable from source.
! ============================================================================

module staticbin
  use, intrinsic :: iso_fortran_env, only: int32, int64
  implicit none
  private

  public :: elias_header, elias_wrap
  public :: encode_fixed, encode_dynamic, encode_integers
  public :: encode_text,  encode_bitfield, encode_small_ints
  public :: stream_of, to_base64url, from_base64url

  character(len=64), parameter :: B64_ALPHABET = &
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"

contains

  ! --------------------------------------------------------------------------
  ! Elias-gamma
  ! --------------------------------------------------------------------------

  pure function int_to_bin(n) result(s)
    integer(int64), intent(in) :: n
    character(len=:), allocatable :: s
    character(len=:), allocatable :: tmp
    integer(int64) :: m
    integer :: i
    if (n == 0_int64) then
      s = "0"
      return
    end if
    tmp = ""
    m = n
    do while (m > 0_int64)
      if (iand(m, 1_int64) == 1_int64) then
        tmp = "1" // tmp
      else
        tmp = "0" // tmp
      end if
      m = ishft(m, -1)
    end do
    s = tmp
  end function int_to_bin

  pure function elias_header(n) result(s)
    integer(int64), intent(in) :: n
    character(len=:), allocatable :: s
    character(len=:), allocatable :: b
    integer :: zeros
    if (n == 0_int64) then
      s = "0"
      return
    end if
    b = int_to_bin(n)
    zeros = len(b) - 1
    s = repeat("0", zeros) // b
  end function elias_header

  pure function elias_wrap(payload) result(s)
    character(len=*), intent(in) :: payload
    character(len=:), allocatable :: s
    if (len_trim(payload) == 0) then
      s = "0"
      return
    end if
    s = elias_header(int(len(payload), int64)) // payload
  end function elias_wrap

  ! --------------------------------------------------------------------------
  ! Section encoders
  ! --------------------------------------------------------------------------

  function encode_fixed(chunks, n) result(s)
    integer, intent(in) :: n
    character(len=*), intent(in) :: chunks(n)
    character(len=:), allocatable :: s, payload
    integer :: i, width
    if (n == 0) then
      s = "01" // elias_wrap("")
      return
    end if
    width = len(chunks(1))
    do i = 2, n
      if (len(chunks(i)) /= width) then
        error stop "FIXED mode requires uniform width"
      end if
    end do
    payload = elias_header(int(width, int64))
    do i = 1, n
      payload = payload // chunks(i)
    end do
    s = "01" // elias_wrap(payload)
  end function encode_fixed

  function encode_dynamic(chunks, n) result(s)
    integer, intent(in) :: n
    character(len=*), intent(in) :: chunks(n)
    character(len=:), allocatable :: s, payload
    integer :: i
    payload = ""
    do i = 1, n
      payload = payload // elias_wrap(trim(chunks(i)))
    end do
    s = "10" // elias_wrap(payload)
  end function encode_dynamic

  function encode_integers(values, n) result(s)
    integer, intent(in) :: n
    integer(int64), intent(in) :: values(n)
    character(len=:), allocatable :: s, payload
    integer :: i
    payload = ""
    do i = 1, n
      if (values(i) < 1_int64) error stop "INTEGER mode requires positive integers"
      payload = payload // elias_header(values(i))
    end do
    s = "11" // elias_wrap(payload)
  end function encode_integers

  ! --------------------------------------------------------------------------
  ! Convenience recipes
  ! --------------------------------------------------------------------------

  function encode_text(text) result(s)
    character(len=*), intent(in) :: text
    character(len=8), allocatable :: chunks(:)
    character(len=:), allocatable :: s
    integer :: i, code
    allocate(chunks(len(text)))
    do i = 1, len(text)
      code = iachar(text(i:i))
      chunks(i) = byte_to_bits(code)
    end do
    s = encode_fixed(chunks, len(text))
  end function encode_text

  pure function byte_to_bits(b) result(s)
    integer, intent(in) :: b
    character(len=8) :: s
    integer :: i, v
    v = b
    do i = 8, 1, -1
      if (iand(v, 1) == 1) then
        s(i:i) = "1"
      else
        s(i:i) = "0"
      end if
      v = ishft(v, -1)
    end do
  end function byte_to_bits

  function encode_bitfield(flags, n) result(s)
    integer, intent(in) :: n
    logical, intent(in) :: flags(n)
    character(len=1), allocatable :: chunks(:)
    character(len=:), allocatable :: s
    integer :: i
    allocate(chunks(n))
    do i = 1, n
      if (flags(i)) then
        chunks(i) = "1"
      else
        chunks(i) = "0"
      end if
    end do
    s = encode_fixed(chunks, n)
  end function encode_bitfield

  function encode_small_ints(values, n, width) result(s)
    integer, intent(in) :: n, width
    integer(int64), intent(in) :: values(n)
    character(len=width), allocatable :: chunks(:)
    character(len=:), allocatable :: s
    integer(int64) :: ceiling, v
    integer :: i, j
    ceiling = ishft(1_int64, width) - 1_int64
    allocate(chunks(n))
    do i = 1, n
      if (values(i) < 0_int64 .or. values(i) > ceiling) then
        error stop "Value does not fit in given width"
      end if
      v = values(i)
      do j = width, 1, -1
        if (iand(v, 1_int64) == 1_int64) then
          chunks(i)(j:j) = "1"
        else
          chunks(i)(j:j) = "0"
        end if
        v = ishft(v, -1)
      end do
    end do
    s = encode_fixed(chunks, n)
  end function encode_small_ints

  ! --------------------------------------------------------------------------
  ! Stream <-> base64url
  ! --------------------------------------------------------------------------

  function stream_of(sections, n) result(s)
    integer, intent(in) :: n
    character(len=*), intent(in) :: sections(n)
    character(len=:), allocatable :: s, joined
    integer :: i
    joined = ""
    do i = 1, n
      joined = joined // trim(sections(i))
    end do
    s = elias_wrap(joined)
  end function stream_of

  function to_base64url(bits) result(s)
    character(len=*), intent(in) :: bits
    character(len=:), allocatable :: s, padded
    integer :: i, group, remainder
    remainder = mod(len(bits), 6)
    if (remainder /= 0) then
      padded = bits // repeat("0", 6 - remainder)
    else
      padded = bits
    end if
    s = ""
    do i = 1, len(padded), 6
      group = bits_to_int(padded(i:i+5))
      s = s // B64_ALPHABET(group + 1 : group + 1)
    end do
  end function to_base64url

  pure function bits_to_int(bits) result(v)
    character(len=*), intent(in) :: bits
    integer :: v, i
    v = 0
    do i = 1, len(bits)
      v = ishft(v, 1)
      if (bits(i:i) == "1") v = v + 1
    end do
  end function bits_to_int

  function from_base64url(text) result(s)
    character(len=*), intent(in) :: text
    character(len=:), allocatable :: s
    integer :: i, j, pos, v
    s = ""
    do i = 1, len(text)
      if (text(i:i) == " " .or. text(i:i) == char(10) .or. &
          text(i:i) == char(13) .or. text(i:i) == char(9)) cycle
      pos = 0
      do j = 1, 64
        if (B64_ALPHABET(j:j) == text(i:i)) then
          pos = j - 1
          exit
        end if
      end do
      if (pos < 0 .or. j > 64) error stop "Invalid base64url character"
      v = pos
      block
        character(len=6) :: six
        integer :: k
        do k = 6, 1, -1
          if (iand(v, 1) == 1) then
            six(k:k) = "1"
          else
            six(k:k) = "0"
          end if
          v = ishft(v, -1)
        end do
        s = s // six
      end block
    end do
  end function from_base64url

end module staticbin
